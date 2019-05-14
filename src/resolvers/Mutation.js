const { hash, compare } = require('bcrypt')
const { sign } = require('jsonwebtoken')
// const { APP_SECRET } = require('../utils')
const { calculateStats } = require('../utils/calculateStats');

const Mutation = {

  async signup(parent, { username, password, gamertag }, ctx) {
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
          gamertag: gamertag,
        }
      }
    );
    // 4. create the JWT token
    const token = sign({ userId: user.id }, process.env.APP_SECRET);
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
    console.log("app_secret!", process.env.APP_SECRET)
    const token = sign({ userId: user.id }, process.env.APP_SECRET);
    
    console.log("logintoken", token)
    // 4. set the cookie with the token
    ctx.response.cookie('token', token, {
      // makes it so token only accessible via http request...not javascript (safety thing)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie (will stay signed in for this long)
    });
    console.log("ctx-response!", ctx.response)
    // 5. return the user
    return user;
  },

  async logout(parent, args, ctx) {
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' }
  },

  async createGame(parent, args, ctx) {
    // check if they are logged in
    if (!ctx.request.userId) {
      // throw an error
      return null;
    }

    // if logged in...create the game
    const game = await ctx.db.mutation.createGame(
      {
        data: {
          gameType: args.gameType,
          result: args.result,
          kills: args.kills,
          deaths: args.deaths,
          author: {
            connect: {
              id: ctx.request.userId
            }
          }
        }
      }
    )

    // grab all games from user
    const user = await ctx.db.query.user(
      { where: { id: ctx.request.userId } },
      '{ games { gameType, result, kills, deaths } }'
    );

    // calculate updated rank
    if (user) {
      const stats = calculateStats(user);

      // update user with rank in db
      await ctx.db.mutation.updateUser({
        data: {
          h2rank: stats.h2.rank,
          h3rank: stats.h3.rank,
        },
        where: {
          id: ctx.request.userId,
        }
      })
    }

    return game
  }
}

module.exports = {
  Mutation,
}
