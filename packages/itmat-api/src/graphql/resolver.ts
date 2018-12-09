import bcrypt from 'bcrypt';

export const resolvers = {
    Query: {
        whoAmI(parent: object, args: any, context: any, info: any): object {
            return context.req.user;
        },
        // getUsers(parent: object, args: any, context: any, info: any): object[] {
        //     // check admin privilege
        //     if (args.username) {

        //     } else {

        //     }
        // },
        // getStudies(parent: object, args: any, context: any, info: any): object[] {
        //     // return only the studies the guy has access to.
        // }
    },
    Mutation: {
        login: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const { db, req, res } = context;
            const result = await db.collection('test_users').findOne({ deleted: false, username: args.username });
            if (!result) {
                return ({ error: true, loggedIn: false, errorMsg: 'Incorrect username' });
            }
            const passwordMatched = await bcrypt.compare(args.password, result.password);
            // const passwordMatched = req.body.password === result.password;
            if (!passwordMatched) {
                return ({ error: true, loggedIn: false, errorMsg: 'Incorrect password' });
            }

            return new Promise(resolve => {
                req.login(result, (err: any) => {
                    if (err) { console.log(err); resolve({ error: true, loggedIn: false }); }
                    // res.status(200).json({ message: 'Logged in!' });
                    resolve({ error: false, loggedIn: true });
                });
            });

        }
    }
};