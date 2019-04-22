// const { verify } = require('jsonwebtoken')

const APP_SECRET = 'nellbell321'

function hasPermission(user, permissionsNeeded) {
  const matchedPermissions = user.permissions.filter(permissionTheyHave =>
    permissionsNeeded.includes(permissionTheyHave)
  );
  if (!matchedPermissions.length) {
    throw new Error(`You do not have sufficient permissions

      : ${permissionsNeeded}

      You Have:

      ${user.permissions}
      `);
  }
}

// class AuthError extends Error {
//   constructor() {
//     super('Not authorized')
//   }
// }

// function getUserId(context) {
//   const Authorization = context.request.get('Authorization')
//   if (Authorization) {
//     const token = Authorization.replace('Bearer ', '')
//     const verifiedToken = verify(token, APP_SECRET)
//     return verifiedToken && verifiedToken.userId
//   }
// }

module.exports = {
  // getUserId,
  APP_SECRET,
  hasPermission,
}
