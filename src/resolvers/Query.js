const { hasPermission } = require('../utils')

const Query = {

  me (parent, args, context) {
    // check if their is a current userId on the request (remember...we added the decoded userId in middleware)
    if (!context.request.userId) {
      // don't throw an error, just return nothing. It's ok not to be logged in
      return null;
    }
    // if there is a userId on the request...query it in the database and return to client
    return context.prisma.user({ id: context.request.userId })
  },

  user (parent, args, context) {
    return context.prisma.user(
      {
        id: args.id,
        username: args.username
      },
    )
  },

  async users (parent, args, context) {
    // 1. check if they are logged in
    if (!context.request.userId) {
      throw new Error ('You must be logged in to do that!')
    }
    // 2. check if the user has the permissions to query all users
    hasPermission(context.request.user, ['ADMIN', 'PERMISSIONUPDATE']);
    
    // 3 if they do, query all the users
    return context.prisma.users()
  },




  // hello: (parent, args, context) => {
  //       return context.prisma.users()
  //     },
  //   me: (parent, args, context) => {
  //     const userId = getUserId(context)
  //     return context.prisma.user({ id: userId })
  //   },
  //   feed: (parent, args, context) => {
  //     return context.prisma.posts({ where: { published: true } })
  //   },
  //   filterPosts: (parent, { searchString }, context) => {
  //     return context.prisma.posts({
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
  //   post: (parent, { id }, context) => {
  //     return context.prisma.post({ id })
  //   },
}

module.exports = {
  Query,
}