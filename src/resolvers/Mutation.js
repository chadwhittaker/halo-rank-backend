const { hash, compare } = require('bcrypt')
const { sign } = require('jsonwebtoken')
const { APP_SECRET, hasPermission } = require('../utils')

const Mutation = {

  async signup (parent, { username, password }, context)  {
    // 1. lowercase their username
    const usernameLower = username.toLowerCase();
    // 2. hash their password
    const hashedPassword = await hash(password, 10);
    // 3. create the user in the database
    const user = await context.prisma.createUser({
      username: usernameLower,
      password: hashedPassword,
      permissions: { set: ['USER'] },
    });
    // 4. create the JWT token
    const token = sign({ userId: user.id }, APP_SECRET);
    // 5. set the JWT as a cookie on the response
    context.response.cookie('token', token, {
      // makes it so token only accessible via http request...not javascript (safety thing)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie (will stay signed in for this long)
    });
    // 6. return the user
    return user;
  },

  async login (parent, { username, password }, context) {
    // 1. check if there is a user with that username
    const user = await context.prisma.user({ username })
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
    context.response.cookie('token', token, {
      // makes it so token only accessible via http request...not javascript (safety thing)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie (will stay signed in for this long)
    });
    // 5. return the user
    return user;
  },

  async logout (parent, args, context) {
    context.response.clearCookie('token');
    return { message: 'Goodbye!' }
  },

  async createDesign (parent, args, context) {
    // 1. check if user is logged in
    if(!context.request.userId) {
      throw new Error('You must be logged in to do that!');
    }
    // 2. check if he user has permission to do this
    const currentUser = context.request.user;
    hasPermission(currentUser, ['ADMIN', 'DESIGNCREATE'])
    // 3. create design in database
    const design = await context.prisma.createDesign(
      {
        // this is how we create a relationship
        author: {
          connect: {
            id: context.request.userId
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
      }
    );
    // 3. return the design
    return design;
  }, 

  async updatePermissions (parent, args, context) {
    // 1. check if they are logged in
    if(!context.request.userId) {
      throw new Error('You must be logged in!')
    }
    // 2. query the current user
    const currentUser = context.request.user;
    // 3. check if they have permissions to do this
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE'])
    // 4. update the permissions
    const user = await context.prisma.updateUser({
      data: {
        permissions: {
          set: args.permissions
        }
      },
      where: {
        id: args.userId
      }
    })
    return user;
  }


  // login: async (parent, { email, password }, context) => {
  //   const user = await context.prisma.user({ email })
  //   if (!user) {
  //     throw new Error(`No user found for email: ${email}`)
  //   }
  //   const passwordValid = await compare(password, user.password)
  //   if (!passwordValid) {
  //     throw new Error('Invalid password')
  //   }
  //   return {
  //     token: sign({ userId: user.id }, APP_SECRET),
  //     user,
  //   }
  // },
  // createDraft: async (parent, { title, content }, context) => {
  //   const userId = getUserId(context)
  //   return context.prisma.createPost({
  //     title,
  //     content,
  //     author: { connect: { id: userId } },
  //   })
  // },
  // deletePost: async (parent, { id }, context) => {
  //   return context.prisma.deletePost({ id })
  // },
  // publish: async (parent, { id }, context) => {
  //   return context.prisma.updatePost({
  //     where: { id },
  //     data: { published: true },
  //   })
  // },
}

module.exports = {
  Mutation,
}
