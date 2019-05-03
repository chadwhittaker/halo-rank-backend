const { hash, compare } = require('bcrypt')
const { sign } = require('jsonwebtoken')
const { APP_SECRET, hasPermission } = require('../utils')
const { selectParts } = require('../utils/selectParts');

const Mutation = {

  async signup(parent, { username, password, firstName, lastName }, ctx) {
    // 1. lowercase their username
    const usernameLower = username.toLowerCase();
    // 2. hash their password
    const hashedPassword = await hash(password, 10);
    // 3. create the user in the database
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          username: usernameLower,
          password: hashedPassword,
          firstName: firstName,
          lastName: lastName,
          permissions: { set: ['USER'] },
        }
      }
    );
    // 4. create the JWT token
    const token = sign({ userId: user.id }, APP_SECRET);
    // 5. set the JWT as a cookie on the response
    ctx.response.cookie('token', token, {
      // makes it so token only accessible via http request...not javascript (safety thing)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie (will stay signed in for this long)
    });
    // 6. return the user
    return user;
  },

  async login(parent, { username, password }, ctx) {
    // 1. check if there is a user with that username
    const user = await ctx.db.query.user({ where: { username } })
    if (!user) {
      throw new Error(`No user found for username: ${username}`)
    }
    // 2. check if their password is correct by hashing the incomeing password and 'comparing'
    const passwordValid = await compare(password, user.password)
    if (!passwordValid) {
      throw new Error('Invalid password')
    }
    // 3. generate the JWT token
    const token = sign({ userId: user.id }, APP_SECRET);
    // 4. set the cookie with the token
    ctx.response.cookie('token', token, {
      // makes it so token only accessible via http request...not javascript (safety thing)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie (will stay signed in for this long)
    });
    // 5. return the user
    return user;
  },

  async logout(parent, args, ctx) {
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' }
  },

  async createDesign(parent, args, ctx) {
    // 1. check if user is logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in to do that!');
    }
    // 2. check if he user has permission to do this
    const currentUser = ctx.request.user;
    hasPermission(currentUser, ['ADMIN', 'DESIGNCREATE'])

    // do a quick calculation to select parts so we can store them in database
    let { inverter, battery, charger, daily_energy_wh, ratedSolarP, cost } = selectParts(args);
    // do rounding for the table / database
    daily_energy_wh = Math.round(daily_energy_wh * 10 / 1000) / 10;
    cost = Math.round(cost * 100) / 100;
    ratedSolarP = Math.round(ratedSolarP * 10 / 1000) / 10;

    // 3. create design in database
    const design = await ctx.db.mutation.createDesign(
      {
        data: {
          // this is how we create a relationship
          author: {
            connect: {
              id: ctx.request.userId
            }
          },
          // create Loads and Connect at the same time
          loads: {
            create: [...args.loads]
          },
          deanery: args.deanery,
          location: args.location,
          parish: args.parish,
          longitude: args.longitude,
          longitudeDir: args.longitudeDir,
          latitude: args.latitude,
          latitudeDir: args.latitudeDir,
          gridTied: args.gridTied,
          generator: args.generator,
          voltage: args.voltage,
          freq: args.freq,
          phase: args.phase,
          area_roof: args.area_roof,
          area_ground: args.area_ground,
          batteryBackup: args.batteryBackup,
          autoHours: args.autoHours,
          images: {
            set: args.images,
          },
          notes: args.notes,
          // param_condEff: param_condEff,
          // param_maxDoD: param_maxDoD,
          // param_maxPowerMarkdown: param_maxPowerMarkdown,
          // param_solarEff: param_solarEff,
          dailyLoad: daily_energy_wh,
          battery: battery.name,
          charger: charger.name,
          inverter: inverter.name,
          cost: cost,
          output_pv: ratedSolarP,
          refDesign: inverter.refDesign,
          bucket: inverter.bucket,
        }
      }
    );
    // 3. return the design
    return design;
  },

  async updateDesign(parent, args, ctx, info) {
    // 1. check if user is logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in to do that!');
    }
    const currentUser = ctx.request.user;
    // 2. find the design
    const author = await ctx.db.query.design({ where: { id: args.id } }, `{ author { id }}`)
    // 3. check if the user owns the design, or has permission    
    const ownsItem = ctx.request.userId === author.id;
    const hasPermissions = currentUser.permissions.some(permission =>
      ['ADMIN', 'DESIGNUPDATE'].includes(permission)
    );
    if (!ownsItem && !hasPermissions) {
      throw new Error("You don't have permission to do that!");
    }

    // RIGHT HERE NEED TO DO MATH AND DETERMINE UPDATED PARTS SELECTION

    // 4. create the object to manipulate the loads
    const loadsUpdateObject = async (args) => {
      // if there are no loads incoming on "args"...don't do anything
      if (!args.loads) return null
      // otherwise, delete all loads connected to this design
      await ctx.db.mutation.deleteManyLoads({ where: { design: { id: args.id }}});
      // construct create loads object
      return {
        create: args.loads.map((load) => {
          const loadRemovedId = { ...load }
          delete loadRemovedId.id;
          return loadRemovedId
        })
      }
    };
    const loadsUpdate = await loadsUpdateObject(args);

    // 5. update the design in the database
    const design = await ctx.db.mutation.updateDesign(
      {
        where: {
          id: args.id
        },
        data: {
          loads: loadsUpdate,     // see below for creation of "loadsUpdate"
          deanery: args.deanery,
          location: args.location,
          parish: args.parish,
          longitude: args.longitude,
          longitudeDir: args.longitudeDir,
          latitude: args.latitude,
          latitudeDir: args.latitudeDir,
          gridTied: args.gridTied,
          generator: args.generator,
          voltage: args.voltage,
          freq: args.freq,
          phase: args.phase,
          area_roof: args.area_roof,
          area_ground: args.area_ground,
          batteryBackup: args.batteryBackup,
          autoHours: args.autoHours,
          images: {
            set: args.images,
          },
          notes: args.notes,
          // param_condEff: param_condEff,
          // param_maxDoD: param_maxDoD,
          // param_maxPowerMarkdown: param_maxPowerMarkdown,
          // param_solarEff: param_solarEff,
          // dayLoad: dayLoad,
          // nightLoad: nightLoad,
          // fullLoad: fullLoad,
          // battery: battery,
          // charger: charger,
          // inverter: inverter,
          // refDesign: refDesign,
          // cost: cost,
          // output_pv: output_pv,
        },
      }, info
    );

    // 6. return the design
    return design;
  },

  async updatePermissions(parent, args, ctx, info) {
    // 1. check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!')
    }
    // 2. query the current user
    const currentUser = ctx.request.user;
    // 3. check if they have permissions to do this
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE'])
    // 4. update the permissions
    const user = await ctx.db.mutation.updateUser({
      data: {
        permissions: {
          set: args.permissions
        }
      },
      where: {
        id: args.userId
      }
    }, info)
    return user;
  }
}

module.exports = {
  Mutation,
}
