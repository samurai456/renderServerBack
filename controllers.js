
class Dispatcher{
    dispatch(data, ws, loggedIn, sessions){
        switch(data.type){
            case 'sign-in': 
                this.signIn(data, ws, loggedIn)
                return
            case 'sign-out':
                this.signOut(ws, loggedIn)
                return
            case 'create-session':
                this.createSession(data, ws, loggedIn, sessions)
                return
            case 'cancel-waiting':
                this.cancelWaiting(data, ws, loggedIn, sessions)
                return
            case 'i-am-joiner':
                this.replyToJoiner(data, ws, loggedIn, sessions)
                return
            case 'i-am-not-joiner':
                this.notAJoiner(data, ws, loggedIn, sessions)
                return
            case 'join-session':
                this.joinSession(data, ws, loggedIn, sessions)
                return
            case 'get-opponent-nickname':
                this.getOpponentNickname(ws, sessions)
                return
            case 'new-moves':
                this.redirectToOpponent(data, ws, sessions)
                return
            case 'offer-try-again':
                this.offerTryAgain(ws, sessions)
                return
            case 'exit-session':
                this.exitSession(ws, sessions)
                return
        }
    }

    signIn(data, ws, loggedIn){
        const takenNicks = loggedIn.map(i=>i.nickname);
        const resp = {type: 'sign-in-stat', nickname: data.nickname};
        if(takenNicks.includes(data.nickname)){
            ws.send(JSON.stringify({ ...resp, stat: 'fail'}));
            return
        }
        loggedIn.push({nickname: data.nickname, ws});
        ws.send(JSON.stringify({ ...resp, stat: 'success'}));
    }

    signOut(ws, loggedIn){
        const i = loggedIn.findIndex(i=>i.ws===ws);
        if(i===-1) return
        loggedIn.splice(i, 1);
    }

    createSession(data, ws, loggedIn, sessions){
        const exists = loggedIn.find(i=>(i.nickname===data.nickname && i.ws===ws));
        if(!exists){
            ws.send(JSON.stringify({type: 'session-stat', stat: 'fail'}));
            return
        }
        const alreadyCreator = sessions.find(i=>(i.creator && i.creator.nickname===data.nickname));
        if(alreadyCreator) return
        const sess = {game: data.game, creator: {nickname: data.nickname, ws}};
        sessions.push(sess);
        ws.send(JSON.stringify({type: 'session-stat', stat: 'success'}));
        this.sendSessionsWaiting(data.game, sessions)
    }

    cancelWaiting(data, ws, loggedIn, sessions){
        const exists = loggedIn.find(i=>(i.nickname===data.nickname && i.ws===ws));
        if(!exists) return
        const i = sessions.findIndex(i=>(i.creator && i.creator.nickname===data.nickname));
        if(i===-1) return
        const game = sessions[i].game;
        sessions.splice(i, 1);
        this.sendSessionsWaiting(game, sessions)
    }

    replyToJoiner(data, ws, loggedIn, sessions){
        const exists = loggedIn.find(i=>(i.nickname===data.nickname && i.ws===ws));
        if(!exists){
            ws.send(JSON.stringify({type: 'sessions-waiting', stat: 'fail'}));
            return
        }
        const sessionsWaiting = sessions
        .filter(i=>(i.game===data.game && !i.joiner))
        .map(i=>({game: i.game, nickname: i.creator.nickname}));
        ws.send(JSON.stringify({ type: 'sessions-waiting', stat: 'success', sessionsWaiting}));
        const alreadyJoiner = sessions.find(i=>(i.joiner && i.joiner.nickname===data.nickname));
        if(alreadyJoiner) return
        sessions.push({joiner: {nickname: data.nickname, ws}, game: data.game});
    }

    notAJoiner(data, ws, loggedIn, sessions){
        const exists = loggedIn.find(i=>(i.nickname===data.nickname && i.ws===ws));
        if(!exists) return
        const i = sessions.findIndex(i=>(i.joiner && i.joiner.nickname===data.nickname));
        if(i===-1) return
        sessions.splice(i, 1);
    }
    
    sendSessionsWaiting(game, sessions){
        const sessionsWaiting = sessions
        .filter(i=>(i.game===game && !i.joiner))
        .map(i=>({game, nickname: i.creator.nickname}));
        const joiners = sessions.filter(i=>(i.game===game && !i.creator && i.joiner));
        joiners.forEach(({joiner})=>joiner.ws.send(
            JSON.stringify({ type: 'sessions-waiting', stat: 'success', sessionsWaiting})
        ));
    }

    joinSession(data, ws, loggedIn, sessions){
        const exists = loggedIn.find(i=>(i.nickname===data.nickname && i.ws===ws));
        if(!exists) return
        const target = sessions.find(i=>(i.creator?.nickname===data.joinTo));
        const i = sessions.findIndex(i=>(i.joiner?.nickname===data.nickname));
        target.joiner = sessions[i].joiner;
        sessions.splice(i,1);
        target.creator.ws.send(JSON.stringify({type: 'player-joined'}));
    }

    getOpponentNickname(ws, sessions){
        const session = sessions.find(i=>(i.creator?.ws===ws || i.joiner?.ws===ws));
        const opponent = session.creator.ws === ws ? session.joiner.nickname: session.creator.nickname;
        ws.send(JSON.stringify({type: 'opponent-nickname', opponentNick: opponent}));
    }

    redirectToOpponent(data, ws, sessions){
        this.sendToOpponent(ws, sessions, JSON.stringify(data));
    }

    offerTryAgain(ws, sessions){
        this.sendToOpponent(ws, sessions, JSON.stringify({type: 'offer-try-again'}));
    }

    exitSession(ws, sessions){
        this.sendToOpponent(ws, sessions, JSON.stringify({type: 'exit-session'}));
        const i = sessions.findIndex(i=>(i.creator?.ws===ws||i.joiner?.ws===ws));
        sessions.splice(i,1)
    }

    sendToOpponent(ws, sessions, data){
        const opponentWs = this.getOpponentWs(ws, sessions)
        opponentWs.send(data);
    }

    getOpponentWs(ws, sessions){
        const session = sessions.find(i=>(i.creator?.ws===ws||i.joiner?.ws===ws));
        const opponentWs = session.creator.ws === ws ? session.joiner.ws: session.creator.ws;
        return opponentWs;
    }
}

module.exports = { Dispatcher };