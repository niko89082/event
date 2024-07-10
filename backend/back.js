const express = require("express")
const app = express();
const PORT = 3000;
const bodyParser = require('body-parser');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json())

app.post("/login", (req, res)=> {
  var user = req.body.user;
  res.status(200);
});

app.get("/login", (req, res) =>{
  var user = req.params.user;
  var pass = req.params.pass;
  
})


app.get('/', (req, res)=>{ 
    res.status(200); 
    res.send("Welcome to root URL of Server"); 
    res.json({requestBody: req.body});
}); 
  
app.listen(PORT, (error) =>{ 
    if(!error) 
        console.log("Server is Successfully Running, and App is listening on port "+ PORT); 
    else 
        console.log("Error occurred, server can't start", error); 
    } 
); 