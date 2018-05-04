global.DEBUG = process.argv[2] == "debug";

const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const https = require("https");
const dateFormat = require("dateformat");
const util = require("./util.js");

let globals = require("./variables.js");
globals.geardb = require("./gear.json");

const chalk = require("chalk");

function logMeta(color, ...args){
    console.log(chalk.gray(dateFormat("[HH:MM:ss]")), ...args.map(x => chalk[color](x)));
}

global.log = (...args) => {
    logMeta("white", ...args);
}

if(DEBUG){
    log("Starting with DEBUG");
}

function setStatus(){
    client.user.setActivity("Active");
}

async function quit(){
    log("Server quitting.");
    return client.destroy();
}

let emojis = {
    x: "❌",
    check: "✅",
    ok: "👍",
    bad: "👎",
};

client.on("ready", async () => {
    log("Starting bot...");
    globals.guild = client.guilds.first();
    globals.gearChannelUpdate = globals.guild.channels.find("name", config.channelNameUpdate);
    globals.gearChannelQuery = globals.guild.channels.find("name", config.channelNameQuery);
    if(!globals.gearChannelUpdate || !globals.gearChannelQuery){
        log("Gear channels not found.");
        return await quit();
    }
    setStatus();
});

client.on("reconnecting", () => {
    log("Reconnecting...");
});

function uploadImage(url, nickname){

    if(DEBUG) return Promise.resolve("https://i.imgur.com/3zQ8i4k.png");

    return new Promise((resolve, reject) => {
        let req = https.request({
            hostname: "api.imgur.com",
            port: 443,
            path: "/3/image",
            method: "post",
            headers: {
                Authorization: "Client-ID " + config.imgurID,
                "Content-Type": "application/json",
            },
        }, res => {
            res.setEncoding("utf-8");
            string = "";
            res.on("data", o => {
                string += o
            });
            res.on("end", () => {
                try{
                    let json = JSON.parse(string);
                    if(!json.success){
                        log(json.data);
                        reject("failed");
                    }
                    resolve(json.data.link);
                }catch(e){
                    log(e);
                    reject("Failed to upload image");
                }
            });
        });

        req.on("error", (e) => {
            log("failed to upload");
            reject("Failed to upload image");
        });

        let title = `${nickname}'s gear: ${dateFormat(globals.dateFormat)}`;

        let data = {
            image: url,
            title, name: title,
            type: "URL",
        };
        req.write(JSON.stringify(data));
        req.end();
    });
};


async function handleGearDM(msg){
    let guildMember = globals.guild.member(msg.author);

    let gearlink;

    let url = /https?:\/\/[^ ]+/.exec(msg.content);
    if(url){
        gearlink = url[0];
    }else if(msg.attachments.first()){
        gearlink = msg.attachments.first().url;
    }else{
        msg.reply("Gearlink not found. Please upload an image, use a command, or send a link");
        msg.react(emojis.x);
        if(!DEBUG) return;
    }


    let name = util.displayName(guildMember);

    let newgearlink;
    try{
        newgearlink = await uploadImage(gearlink, name);
    }catch(e){
        msg.reply("Image failed to upload or save. Please make sure you have a link/attachment to an image and try again.");
        msg.react(emojis.x);
        log(e)
        return
    }


    msg.react(emojis.check);
    msg.reply("Gear sucessfully updated.");
    log(`${name} has updated their gear to ${newgearlink}`);

    let gearMsg = await globals.gearChannelUpdate.send(`<@!${msg.author.id}> has updated their gear: ${gearlink}`);
    await gearMsg.react(emojis.check);
    await gearMsg.react(emojis.x);

    globals.geardb[msg.author.id] = {
        nickname: guildMember.nickname,
        username: msg.author.username,
        name,
        imgurLink: newgearlink,
        originalLink: gearlink,
        originalMsgID: msg.id,
        date: Date.now(),
        gearChannelMsg: gearMsg.id,
        status: "unverified",
        userID: msg.author.id,
    };
    await util.saveGear();
}

const commands = require("./commands.js");

async function handleGearChannel(msg){
    for(let command of Object.keys(commands)){
        if(msg.content.split(" ")[0].toLowerCase() === config.prefix + command){
            log(`${util.displayName(msg.author)} ran '${command}': ${msg.content}`);
            await commands[command](msg);
            break;
        }
    }
}

client.on("message", async msg => {
    if(msg.author.bot) return;
    if(!globals.guild) return log("couldn't connect to any guild...");
    if(msg.channel.type === "dm"){
        await handleGearDM(msg);
    }else{
        if(msg.channel === globals.gearChannelQuery){
            await handleGearChannel(msg);
        }else{
            return;
        }
    }
});

client.on("messageReactionAdd", async (msgReaction, reactingUser) => {
    if(msgReaction.message.channel !== globals.gearChannelUpdate) return;
    if(msgReaction.me && msgReaction.users.array().length == 1) return;
    for(let gearInfo of Object.values(globals.geardb)){
        if(gearInfo.gearChannelMsg !== msgReaction.message.id) continue;
        if(gearInfo.status !== "unverified") return;

        if(msgReaction.emoji.name === emojis.check){
            gearInfo.status = "accepted";
            log("\taccepted");
        }else if(msgReaction.emoji.name === emojis.x){
            gearInfo.status = "denied";
            log("\tdenied");
        }else{
            return;
        }
        log(`${util.displayName(reactingUser)} reacted to ${gearInfo.name}, ${gearInfo.status}`);

        let msg = await globals.gearChannelUpdate.fetchMessage(gearInfo.gearChannelMsg);
        await msg.clearReactions();
        msg.react(gearInfo.status === "accepted" && emojis.check || emojis.x);
        msg.react(emojis.ok);

        await util.saveGear();

        let user = globals.guild.members.find(user => user.user.id === gearInfo.userID);
        if(user){
            let dmCh = await user.createDM();
            let dmMsg = await dmCh.fetchMessage(gearInfo.originalMsgID);
            if(gearInfo.status == "denied"){
                user.send(`Your gear screenshot was denied by <@!${reactingUser.id}>. Please resubmit or contact an officer.`);
                dmMsg.react(emojis.bad);
            }else{
                dmMsg.react(emojis.ok);
            }
        }else{
            log("Couldnt find user.");
        }

        return;
    }
});

client.on("messageReactionRemove", async (msgReaction, user) => {
    //log(msgReaction, user);
});
client.login(config.token);;
