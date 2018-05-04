const Discord = require("discord.js");
const fs = require("fs");

function displayName(user){
    if(user instanceof Discord.GuildMember){
        //When in a server, people can rename themselves
        return user.nickname || user.user.username;
    }else if(user instanceof Discord.User){
        //When in a dm, default to their username
        return user.username;
    }else if(user.username){
        //Grasp at straws...
        return user.username;
    }else if(user.id){
        return user.id;
    }else{
        return "unknown";
    }
}

async function saveGear(){
    fs.renameSync("./gear.json", "./gear.old.json");
    fs.writeFileSync("./gear.json", JSON.stringify(globals.geardb));
}

module.exports = {displayName, saveGear};
