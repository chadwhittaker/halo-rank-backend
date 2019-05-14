// require('dotenv').config({ path: 'variables.env' });  // not currently using these env variables
// const { APP_SECRET } = require('./utils');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { GraphQLServer } = require('graphql-yoga');
const db = require('./db');
const { resolvers } = require('./resolvers');

// define the GraphQL server
const server = new GraphQLServer({
  typeDefs: 'src/schema.graphql',
  resolvers,
  resolverValidationOptions: {
    requireResolversForResolveType: false,
  },
  // middlewares: [permissions],
  context: req => {
    return {
      ...req,
      db,
    }
  },
})

// DEFINE MIDDLEWARES // a middleware will run in the MIDDLE...between your request and your response ///
// server.express.use((req, res, next) => {
//   // req - request from client
//   // res - response from server
//   // next - function to go to next step
// });

// middleware to handle cookies (JWT)
server.express.use(cookieParser());       // gives us handy little methods like 'clearCookie' and 'cookie' to use in mutations

// middleware to decode the JWT so we can get the User Id on each request
server.express.use((req, res, next) => {
  // grab the token from cookies
  console.log("cookies", req.cookies)
  const { token } = req.cookies;
  console.log("token", token)

  if(token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    console.log("userId", userId)
    // put the decoded userId onto the req for future requests to access
    req.userId = userId;
  }
  next();
});

// middleware to populate the user on each requst
server.express.use(async (req, res, next) => {
  // if they aren't logged in, skip this
  if (!req.userId) return next();
  const user = await db.query.user(
    { where: { id: req.userId } },
    '{ id, username }'
  );

  req.user = user;
  next();
});


server.start(
  {
    cors: {
      credentials: true,                  // need these two lines to endable token / cookie
      origin: process.env.FRONTEND_URL,    // frontend domain, only allows credentials from here??
    },
  },
  deets => {
    console.log(`Server is now running on port http://localhost:${deets.port}`);
  }
);