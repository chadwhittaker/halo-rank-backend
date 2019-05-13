
const calculateStats = (stats) => {
  // console.log(stats);

  const h2games = stats.games.filter((game) => game.gameType === "h2");
  const h3games = stats.games.filter((game) => game.gameType === "h3");

  const h2rank = calculateRank(h2games);
  const h3rank = calculateRank(h3games);

  const h2record = calculateRecord(h2games);
  const h3record = calculateRecord(h3games);

  const h2kd = calculateKD(h2games);
  const h3kd = calculateKD(h3games);

  return {
    h2: {
      rank: h2rank,
      record: h2record,
      kd: h2kd,
    },
    h3: {
      rank: h3rank,
      record: h3record,
      kd: h3kd,
    },
  }
}

const calculateKD = (games) => {
  const kills = games.reduce((kills, game) => kills + game.kills, 0);
  const deaths = games.reduce((deaths, game) => deaths + game.deaths, 0);

  const kd = Math.round(kills / deaths * 100) / 100 ? Math.round(kills / deaths * 100) / 100 : 0;

  return kd.toFixed(2);
}

const calculateRecord = (games) => {

  const wins = games.reduce((wins, game) => game.result === 'win' ? wins + 1 : wins, 0);
  const losses = (games.length) - wins;

  const record = `${wins} - ${losses}`;

  return record
}


const calculateRank = (games) => {
  const rankChart = [1, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000, 5250, 5500, 5750, 6000, 6250, 6500, 6750, 7000, 7250, 7500, 7750, 8000, 8250, 8500, 8750, 9000, 9250, 9500, 9750, 10000, 10250,];

  let exp = 0;
  let rank = 1;
  let newRank = 1;

  for (let i = 0; i < games.length; i++) {
    // calculate exp after each game
    if (games[i].result === 'win') {
      exp += 100;
    } else {
      exp -= 100;
      exp = exp < 0 ? 0 : exp;
    }
    // console.log("")
    // console.log("exp", exp);

    // determine new rank after each game
    for (let i = 0; i < rankChart.length; i++) {
      if (exp >= rankChart[rankChart.length - 1 - i]) {
        newRank = rankChart.length - i;
        // console.log("newRank", newRank)

        if (newRank >= rank) {
          rank = newRank;
          // console.log("givenRank", rank)
        } else {
          const breakpoint = ((rankChart[newRank] - rankChart[newRank - 1]) / 2) + rankChart[newRank - 1]
          // console.log("breakpoint", breakpoint);

          // if your exp dropped more than halfway down the next level, then you drop
          if (exp < breakpoint) {
            rank = newRank;
            // console.log("givenRank", rank)
          } else {
            // console.log("givenRank", rank)
          }
        }
        break;
      }
    }
  }
  return rank;
}

module.exports = {
  calculateStats
}