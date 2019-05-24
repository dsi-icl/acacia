const users = [{ 
    "username" : "standardUser", 
    "type" : "STANDARD", 
    "realName" : "Chan Tai Man", 
    "password" : "$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi", 
    "createdBy" : "admin", 
    "email" : "standard@user.io", 
    "description": "I am a standard user.",
    "emailNotificationsActivated" : true, 
    "organisation":  "DSI",
    "deleted" : false, 
    "id" : "replaced_at_runtime",
},
{ 
    "username" : "admin", 
    "type" : "ADMIN", 
    "realName" : "admin", 
    "password" : "$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi", 
    "createdBy" : "chon", 
    "organisation":  "DSI",
    "email" : "admin@user.io", 
    "description": "I am an admin user.",
    "emailNotificationsActivated" : false, 
    "deleted" : false, 
    "id" : "replaced_at_runtime", 
}];

module.exports = users;