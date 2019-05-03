// NEVER EDIT THIS CALCULATION!!!!
// accept to add default params
// ALWAYS EDIT ON THE FRONT END AND COPY HERE
// FRONT END CALC AND BACKEND CALC MUST BE IDENTICAL

// need to add these below lines each time you copy in the new function
// calculated cost to store in db
// const cost = 1.1 * panel.cost * numPanelsSelected + inverter.cost * inverter.qty + charger.cost * charger.qty + battery.cost * battery.qty + inverter.mc_qty * inverter.mc_cost;
// inputs.param_condEff = 0.98;
// inputs.param_maxDoD = 0.5;
// inputs.param_maxPowerMarkdown = 0.05;
// inputs.param_solarEff = 0.86;

const { panels, inverters, batteries, chargers } = require('./parts');

function selectParts(inputs) {
  // KEEP EVERYTHING IN WATTS AND WATT-HOURS UNTIL THE VERY END

  // set params because this is the first calc. Must match deafults in datamodel
  inputs.param_condEff = 0.98;
  inputs.param_maxDoD = 0.5;
  inputs.param_maxPowerMarkdown = 0.05;
  inputs.param_solarEff = 0.86;

  //local variables not available to user
  const peakSunHours = 4.8;      // this is used as an estimate for sizing, actual solar output taken from NREL API
  const solarInvEffApprox = 0.97;     // used in estimateing solar sizing
  const batteryInvEffApprox = 0.93;
  const sysVoltage = 48;
  const areaMarkup = 0.25;

  // default parts to blank
  let panel = { ...panels[0] };
  let inverter = { ...inverters[0] };
  let battery = { ...batteries[0] };
  let charger = { ...chargers[0] };

  // ================================
  // 1. CALCULATE LOAD
  // ================================

  // calculate full load
  const day_energy_full_wh = inputs.loads.reduce((sum, load) => sum + (load.quantity * load.power * load.dayUsage), 0);
  const night_energy_full_wh = inputs.loads.reduce((sum, load) => sum + (load.quantity * load.power * load.nightUsage), 0);
  const daily_energy_full_wh = day_energy_full_wh + night_energy_full_wh;
  const weekly_energy_full_wh = inputs.loads.reduce((sum, load) => sum + (load.quantity * load.power * (load.dayUsage + load.nightUsage) * load.usageDays), 0);

  // calculate covered load
  const day_energy_wh = inputs.loads.reduce((sum, load) => load.crit ? sum + (load.quantity * load.power * load.dayUsage) : sum, 0);
  const night_energy_wh = inputs.loads.reduce((sum, load) => load.crit ? sum + (load.quantity * load.power * load.nightUsage) : sum, 0);
  const daily_energy_wh = day_energy_wh + night_energy_wh;
  const weekly_energy_wh = inputs.loads.reduce((sum, load) => load.crit ? sum + (load.quantity * load.power * (load.dayUsage + load.nightUsage) * load.usageDays) : sum, 0);

  const peak_load_w = inputs.loads.reduce((sum, load) => load.crit ? sum + load.quantity * load.power : sum, 0) * (1 - inputs.param_maxPowerMarkdown);
  const peak_surge_w = inputs.loads.reduce((sum, load) => load.crit ? sum + load.quantity * load.power * load.surgeMult : sum, 0) * (1 - inputs.param_maxPowerMarkdown);
  let days_on = weekly_energy_wh / daily_energy_wh;
  days_on = !days_on ? 0 : days_on;
  const critLoad = inputs.loads.reduce((bool, load) => !load.crit ? true : bool, false)

  // calculate load averages (daily, monthly, yearly)
  const daily_energy_average_wh = weekly_energy_wh / 7;
  const yearly_energy_average_wh = daily_energy_average_wh * 365;
  const monthly_energy_average_wh = yearly_energy_average_wh / 12;

  // ================================
  // 2. SELECT PANEL 
  // ================================

  // default panel selected above
  const panelPowerEffective = panel.pmax * inputs.param_solarEff;


  // ================================
  // 3. SELECT BATTERY
  // ================================

  // battery sizing
  const autoDays = inputs.autoHours / 24;
  const cap_needed_full_day = daily_energy_wh / sysVoltage;
  const cap_needed_auto = cap_needed_full_day * autoDays;

  // select battery
  for (let i = 0; i < batteries.length; i++) {
    // if battery capacity (after losses) is greater than capacity needed for autonomy, assign to batterySelected
    if (cap_needed_auto < (batteries[i].ahr_8hr * inputs.param_maxDoD * batteryInvEffApprox * inputs.param_condEff)) {
      Object.assign(battery, batteries[i]);
      break
    } else if (i === batteries.length - 1) {
      // if on the last loop and haven't broken yet...
      // set to custom solution
      battery = {
        name: "Custom Battery",
        manuf: "Deka",
        voltage: 48,
        ahr_8hr: (cap_needed_auto / inputs.param_maxDoD / batteryInvEffApprox / inputs.param_condEff),
        eff: 0.9,
      }
      battery.imax_charge = battery.ahr_8hr * 0.3;
      battery.imax_discharge = battery.ahr_8hr;
      battery.cost = (battery.ahr_8hr * inputs.param_maxDoD * batteryInvEffApprox * inputs.param_condEff) * battery.voltage / 1000 * 456.72;
    }
  }
  // battery calculations based on selected
  battery.ahrFull = battery.ahr_8hr * inputs.param_maxDoD;    // battery capacity (Ahr)
  battery.energyFull = battery.ahrFull * battery.voltage;   // battery energy (Whr)



  // ========================================================================================
  // 4. ESTIMATE SOLAR PANEL (W) NEEDED (based on batteryInvEffApprox and solarInvEffApprox)
  // ========================================================================================
  // this is needed to select an inverter appropriately without going over on the solar limit

  // estimate if it will be AC or DC solar inverter based on peak load
  const ACinverterEst = peak_load_w < 12000 ? false : true;

  // need to estimate these variables
  let solarWhrNeededLoadEst = 0;
  let solarWhrNeededBatEst = 0;

  if (!ACinverterEst) {
    // if DC solar inverter (Outback)
    solarWhrNeededLoadEst = day_energy_wh / solarInvEffApprox / batteryInvEffApprox / inputs.param_condEff;
    // energy needed for bat should not exceed night_energy...because if night energy is less than
    // a full battery than we are not draining the battery every night...so you won't need to fill it fullly the next day
    solarWhrNeededBatEst = Math.min((battery.energyFull / solarInvEffApprox / battery.eff / inputs.param_condEff), (night_energy_wh / solarInvEffApprox / battery.eff / batteryInvEffApprox / inputs.param_condEff));
  } else {
    // if AC solar inverter (SMA)
    solarWhrNeededLoadEst = day_energy_wh / solarInvEffApprox / inputs.param_condEff;
    solarWhrNeededBatEst = Math.min((battery.energyFull / solarInvEffApprox / batteryInvEffApprox / battery.eff / inputs.param_condEff), (night_energy_wh / solarInvEffApprox / batteryInvEffApprox / battery.eff / batteryInvEffApprox / inputs.param_condEff));
  }
  const solarWhrNeededEst = solarWhrNeededLoadEst + solarWhrNeededBatEst;
  const numPanelsNeededEst = Math.ceil(solarWhrNeededEst / (panelPowerEffective * peakSunHours));

  // select how many panels we need (increments of 3)
  const numPanelsSelectedEst = Math.ceil(numPanelsNeededEst / 3) * 3;
  const ratedSolarPEst = numPanelsSelectedEst * panel.pmax;


  // ================================
  // 5. SELECT INVERTER
  // ================================
  for (let i = 0; i < inverters.length; i++) {
    // if peak load is less than inverter max power, assign to inverterSelected
    if (peak_load_w < inverters[i].p_cont && ratedSolarPEst <= inverters[i].pv_max) {
      Object.assign(inverter, inverters[i]);
      break
    } else if (i === inverters.length - 1) {
      // if on the last loop and haven't broken yet...
      // set to custom solution
      inverter = {
        name: "Custom SMA",
        manuf: "SMA",
        phase: 3,
        p_cont: peak_load_w + 1,   // equals max continuour power of location 
        eff: 0.93,
        p_charger: 0,
        pv_max: 150000,  // guestimage
        ideal_string_size: 16,
        multicluster: true,
        ACinverter: true
      };
      inverter.p_30m = inverter.p_cont * 1.333;
      inverter.p_surge = inverter.p_cont * 1.833;
      inverter.cost = inverter.p_cont * 0.55;
    }
  }

  // ===============================================================================
  // 6. CALCULATE USABLE BATTERY ENERGY (depends on efficiency of inverter selected)
  // ===============================================================================
  battery.ahrUsable = battery.ahr_8hr * inputs.param_maxDoD * inverter.eff * inputs.param_condEff;
  battery.energyUsable = battery.ahrUsable * battery.voltage;

  // ======================================
  // 7. CALCULATE HOURS OF AUTONOMY ACTUAL
  // ======================================
  const autoHoursActual = battery.energyUsable / daily_energy_wh * 24;

  // ==============================================================
  // 8. CALCULATE # OF SOLAR PANELS NEEDED, STRINGS, & SOLAR POWER
  // ==============================================================
  let solarWhrNeededLoad = null;
  let solarWhrNeededBat = null;

  if (!inverter.ACinverter) {
    // if DC solar inverter (Outback)
    solarWhrNeededLoad = day_energy_wh / solarInvEffApprox / inverter.eff / inputs.param_condEff;
    // energy needed for bat should not exceed night_energy...because if night energy is less than
    // a full battery than we are not draining the battery every night...so you won't need to fill it fullly the next day
    solarWhrNeededBat = Math.min((battery.energyFull / solarInvEffApprox / battery.eff / inputs.param_condEff), (night_energy_wh / solarInvEffApprox / battery.eff / inverter.eff / inputs.param_condEff));
  } else {
    // if AC solar inverter (SMA)
    solarWhrNeededLoad = day_energy_wh / solarInvEffApprox / inputs.param_condEff;
    solarWhrNeededBat = Math.min((battery.energyFull / solarInvEffApprox / inverter.eff / battery.eff / inputs.param_condEff), (night_energy_wh / solarInvEffApprox / inverter.eff / battery.eff / inverter.eff / inputs.param_condEff));
  }
  const solarWhrNeeded = solarWhrNeededLoad + solarWhrNeededBat;

  // calculate # of panels needed
  const numPanelsNeeded = Math.ceil(solarWhrNeeded / (panelPowerEffective * peakSunHours));


  // calculate max strings allowed (need to do this here bc we haven't selected a charger yet but we need to make sure we don't exceed the string limit)
  let numPanelsSelected = null;
  if (!inverter.ACinverter) {
    // for Outback, make sure you don't go over Max String Size
    const maxStringsEst = 24;
    numPanelsSelected = Math.min((Math.ceil(numPanelsNeeded / inverter.ideal_string_size) * inverter.ideal_string_size), (maxStringsEst * inverter.ideal_string_size));
  } else {
    // for SMA do string sizing later, just select # of panels needed
    numPanelsSelected = numPanelsNeeded;
  }

  // calculate strings and final solar power
  const numStrings = numPanelsSelected / inverter.ideal_string_size;
  const ratedSolarP = numPanelsSelected * panel.pmax;
  const effectiveSolarP = ratedSolarP * inputs.param_solarEff;
  const areaRequired = (numPanelsSelected * panel.area) * (1 + areaMarkup);    // meters squared, includes markup


  // ======================================
  // 9. SELECT SOLAR CHARGER
  // ======================================

  if (!inverter.ACinverter) {
    // if DC solar charger needed (Outback Solution)
    // select charger
    for (let i = 0; i < chargers.length; i++) {
      // if its a DC inverter & the rated Solar < Rated Power of Inverter, assign it to chargerSelected
      if (!chargers[i].ACinverter && (ratedSolarP < (chargers[i].pmax + inverter.p_charger) && numStrings <= (chargers[i].max_num_strings + inverter.max_num_strings))) {
        Object.assign(charger, chargers[i]);
        break
      }
    }
  } else {
    // if AC solar charger needed (SMA Solution)
    // select charger
    for (let i = 0; i < chargers.length; i++) {
      // if its a AC inverter & the rated Solar < Rated Power of Inverter, assign it to chargerSelected
      if (chargers[i].ACinverter && (ratedSolarP < (chargers[i].pmax + inverter.p_charger))) {
        Object.assign(charger, chargers[i]);
        break
      } else if (i === chargers.length - 1) {
        charger = {
          name: "Custom SMA",
          manuf: "SMA",
          refDesign: 2,
          bucket: 4,
          pmax: ratedSolarP,                  // watts
          vmax: 1000,                    // volts
          eff: 0.97,                   // percentage
          ideal_string_size: 16,
          ACinverter: true
        };
        // for custom SMA only
        charger.imax = charger.pmax * 0.002583;
        charger.cost = charger.pmax * 0.11;
        charger.max_num_strings = Math.ceil(charger.pmax / 25550 * 6);
      }
    }
  }
  // fill in the rest of the Charger specs now that it's chosen
  charger.pmax = charger.pmax + inverter.p_charger;     // add in the built in charger from inverter
  // if its an Outback inverter need to calculated imax and number of strings
  if (charger.manuf === "Outback") {
    charger.imax = charger.pmax / 4000 * 80;
    charger.max_num_strings = charger.pmax / 4000 * 4;
  }

  // calculated cost to store in db
  const cost = 1.1 * (panel.cost * numPanelsSelected + inverter.cost * inverter.qty + charger.cost * charger.qty + battery.cost * battery.qty + inverter.mc_qty * inverter.mc_cost);

  return {
    inputs,
    panel,
    inverter,
    battery,
    charger,
    // full load
    day_energy_full_wh,
    night_energy_full_wh,
    daily_energy_full_wh,
    weekly_energy_full_wh,
    // covered load
    day_energy_wh,
    night_energy_wh,
    daily_energy_wh,
    weekly_energy_wh,
    peak_load_w,
    peak_surge_w,
    // load averages
    daily_energy_average_wh,
    yearly_energy_average_wh,
    monthly_energy_average_wh,
    // other
    critLoad,
    days_on,
    solarWhrNeeded,
    solarWhrNeededLoad,
    solarWhrNeededBat,
    autoHoursActual,
    numPanelsSelected,
    numStrings,
    ratedSolarP,
    effectiveSolarP,
    areaRequired,
    cost,
  }
}

module.exports = {
  selectParts,
}