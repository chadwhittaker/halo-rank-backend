const { hash, compare } = require('bcrypt')
const { sign } = require('jsonwebtoken')
const { APP_SECRET, getUserId } = require('../utils')

const Mutation = {

  signup: async (parent, { username, password }, context) => {
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

  login: async (parent, { username, password }, context) => {
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

  logout: async (parent, args, context) => {
    context.response.clearCookie('token');
    return { message: 'Goodbye!' }
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
