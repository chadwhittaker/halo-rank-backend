const { hasPermission } = require('../utils')

const Query = {

  me(parent, args, ctx, info) {
    // check if their is a current userId on the request (remember...we added the decoded userId in middleware)
    if (!ctx.request.userId) {
      // don't throw an error, just return nothing. It's ok not to be logged in
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
    hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);

    // 3 if they do, query all the users
    return ctx.db.query.users({}, info)
  },

  async designs(parent, args, ctx, info) {
    return ctx.db.query.designs({}, info)
  },

  async design(parent, args, ctx, info) {
    return ctx.db.query.design(
      {
        where: { id: args.id }
      }, info)
  }







  // hello: (parent, args, ctx) => {
  //       return ctx.db.query.users()
  //     },
  //   me: (parent, args, ctx) => {
  //     const userId = getUserId(ctx)
  //     return ctx.db.query.user({ id: userId })
  //   },
  //   feed: (parent, args, ctx) => {
  //     return ctx.db.query.posts({ where: { published: true } })
  //   },
  //   filterPosts: (parent, { searchString }, ctx) => {
  //     return ctx.db.query.posts({
  //       where: {
  //         OR: [
  //           {
  //             title_contains: searchString,
  //           },
  //           {
  //             content_contains: searchString,
  //           },
  //         ],
  //       },
  //     })
  //   },
  //   post: (parent, { id }, ctx) => {
  //     return ctx.db.query.post({ id })
  //   },
}

module.exports = {
  Query,
}
