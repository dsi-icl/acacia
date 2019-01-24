import ApolloClient, { InMemoryCache } from "apollo-boost";

const cache = new InMemoryCache({
  dataIdFromObject: object => `${object.__typename || 'undefined_typeName'}___${object.id || 'undefined_id'}`
});

export const client = new ApolloClient({
  uri: "http://localhost:3003/graphql",
  credentials: 'include',
  cache
});