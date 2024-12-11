const http = require("http");
const app = require("express")();

app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
// port that will host the page; And the HTML page has code that connects
// to port 9090 (where the websocket is hosted)
app.listen(9091, ()=>console.log("Listening on http port 9091"));

const httpServer = http.createServer();
const websocketServer = require("websocket").server




// const fs = require("fs");

// const server = http.createServer((req, res) => {
//     if (req.url === "/") {
//         fs.readFile("index.html", (err, data) => {
//             if (err) {
//                 res.writeHead(500);
//                 res.end("Erro ao carregar index.html");
//             } else {
//                 res.writeHead(200, { "Content-Type": "text/html" });
//                 res.end(data);
//             }
//         });
//     }
// });
// server.listen(9091, () => console.log("Listening on http port 9091"));



// { clientId: { connection } }
const clients = {};

// Start a server listening to connections on port 9090
httpServer.listen(9090, () => console.log("Listening on port 9090"));

const wsServer = new websocketServer({
    "httpServer": httpServer
});

wsServer.on("request", request => {
    // accept any -> TCP CONNECTION
   const connection = request.accept(null, request.origin);
   connection.on("open", () => console.log("opened connection"))
   connection.on("close", () => console.log("closed connection"))
   connection.on("message", () => {
      // Whenever receives a message from the client
	const result = JSON.parse(message.utf8Data)
	console.log(result)
   })
   // generating a new clientID
   const clientId = guid();
   clients[clientId] = {
        "connection": connection,
   }

   // what we will send to the user 
   const payLoad = {
	"method": "connect",
	"client": clientId
   }

   // send back the client connect 
   connection.send(JSON.stringify(payLoad));


})



//* https://stackoverflow.com/posts/44996682/revisions
function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
