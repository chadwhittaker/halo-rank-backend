const Query = {

  me(parent, args, ctx, info) {
    // check if their is a current userId on the request (remember...we added the decoded userId in middleware)
    if (!ctx.request.userId) {
      // don't throw an error, just return nothing. It's ok not to be logged in
      console.log("returning null!!!")
      return null;
    }
    // if there is a userId on the request...query it in the database and return to client
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId },
      }, info)
  },

  user(parent, args, ctx, info) {
    return ctx.db.query.user(
      {
        where: {
          id: args.id,
          username: args.username
        },
      }, info)
  },

  async users(parent, args, ctx, info) {
    // 1. check if they are logged in
    if (!ctx.request.userId) {
      throw new Error ('You must be logged in to do that!')
    }
    // 2. check if the user has the permissions to query all users

    // 3 if they do, query all the users
    return ctx.db.query.users({}, info)
  },

  async games(parent, args, ctx, info) {

    const games = await ctx.db.query.games(
      {
        where: {
          author: {
            id: args.id,
          }
        }
      }, info);

    return games
  }
}

module.exports = {
  Query,
}
