import ApolloClient from "apollo-boost";

export const client = new ApolloClient({
  uri: "http://localhost:3003/graphql",
  credentials: 'include'
});