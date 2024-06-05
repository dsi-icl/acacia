export interface ApolloServerContext {
    req: Express.Request;
    token?: string;
}