const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { Dispatcher } = require('./controllers.js');

const app = express();


app.use('/assets', express.static(path.join(__dirname, '/dist/assets')))

const callback = (req, res) =>{
    res.sendFile(path.join(__dirname, '/dist/index.html'));
}

app.get('/', callback);
app.get('/sign-in', callback);
app.get('/join-create-session/:game', callback);
app.get('/waiting-room/:game', callback);
app.get('/session-menu/:game', callback);
app.get('/game/:game', callback);

const server = http.createServer(app);
const webSocketServer = new WebSocket.Server({ server });

const loggedIn = [];
const sessions = [];

const dispatcher = new Dispatcher;

webSocketServer.on('connection', ws=>{
    ws.send('welcome! (from server)');
    ws.on('message', m=>{
        let data;
        try {
            data = JSON.parse(m);
        } catch (e) {
            ws.send('client message is not json! (from server)')
            console.log('client message is not json!');
            return
        }
        try{
            dispatcher.dispatch(data, ws, loggedIn, sessions);
        } catch (e) {
            console.log(e)
        }
    })

    ws.on('close', ()=>{
        const i = loggedIn.findIndex(i=>i.ws===ws);
        if (i!==-1){
            loggedIn.splice(i, 1)
            const sI = sessions.findIndex(i=>(i.creator?.ws===ws || i.joiner?.ws===ws));
            if(sI!==-1) deleteSession(sI, sessions, ws);
        }
    })

    function deleteSession(i, sessions, ws){
        const game = sessions[i].game
        const deletingSessionHasCreator = sessions[i].creator
        const deletingSessionHasJoiner = sessions[i].joiner
        if(deletingSessionHasCreator && !deletingSessionHasJoiner){      
            sessions.splice(i, 1);
            dispatcher.sendSessionsWaiting(game, sessions);
            return
        }
        if(deletingSessionHasCreator && deletingSessionHasJoiner){
            dispatcher.sendToOpponent(ws, sessions, JSON.stringify({type: 'exit-session'}));
        }
        sessions.splice(i, 1);
    }
});

server.listen(80, ()=>console.log('good...'));