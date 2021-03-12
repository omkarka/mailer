
const {Base64} = require('js-base64');    //this is required for encoding purpore because gmail messages are endoded in base64
const fs = require('fs');                 //this is required for reading & writing token file
const {google} = require('googleapis');   //this is google api which is important in this program
const express = require('express');       //this is used to host our application
const app = express();
const multer = require('multer');
const bodyParser = require('body-parser');
const { isNullOrUndefined } = require('util');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'))
app.use(bodyParser.json())

const gmail = google.gmail('v1');

// we are using 2 scope here 1.readonly and 2. send
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
'https://www.googleapis.com/auth/gmail.send'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first time.
const TOKEN_PATH = 'token.json';    //set path of token to store
let oAuth2Client = null;            //to access in get method at 'sendmail' path this is required



var to
var subject
var Body
var path
var CC


//To store files on Local system
var Storage = multer.diskStorage({
  destination: function(req, file, callback) {
      callback(null, "./files");
  },

// Name for the file with Date
  filename: function(req, file, callback) {
      callback(null,file.fieldname + "_" + Date.now()+ "_"+   file.originalname );
  }
});
const maxSize = 20 * 1024 * 1024;

// To select single file and store
var upload = multer({
  storage: Storage,
  limits:{ fileSize: maxSize }
}).single("files") 


app.get('/',(req,res) => {                                  // Transfer index.html file at given path or as home page
  res.sendFile(__dirname + '/index.html')
})


//this is actual path to send mail
//form action 
app.post('/sendmail',(req,res) => {
  upload(req,res,function(error){
  if(error){
      console.log(error)
      return res.end("Something went wrong!");
  } else{
      to = req.body.to
      subject = req.body.subject
      Body = req.body.Body
      CC= req.body.cc
            
      if(isNullOrUndefined(req.file)){                            
          path=null;
      }else{
          path = req.file.path
      }
      
      console.log("To: "+to)
      console.log("CC: "+CC)
      console.log("subject:"+subject)
      console.log("Body:"+Body)
      console.log("path:"+path)

      
      
 
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err)
    // Authorize a client with credentials, then call the Gmail API.
    authorize(JSON.parse(content), res,);
  });
}
});
})


// Create an OAuth2 client with the given credentials
function authorize(credentials, res) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;  //if you dowloaded credentials.json then change key name from 'web' to 'installed' or change installed to web in this line
  oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);      //set id,secret,and redirect_uri for move later 

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, res); //if not then get new tocken
    oAuth2Client.setCredentials(JSON.parse(token));
    const message =  sendmessage(oAuth2Client);
    console.log(message);
    res.send(message);
  });
}


function getNewToken(oAuth2Client, res) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',   //this is used to get both access and refresh token
    scope: SCOPES,            //set the scope
  });
  
  res.redirect(authUrl);      //move to login or sign-in page of google to get token.
}

// When user will sign in by google it will rediect to here for storing token sended by google
app.get('/sendmail',(req,res)=>{
  if(oAuth2Client!=null){         //check user is sign-in
    if(req.query.code){           //check proper token return by google
      oAuth2Client.getToken(req.query.code, (err, token) => {
        if (err){                                             //check for proper token
          console.error('Error retrieving access token', err);
          return res.send("Error: please retry");
        }
        oAuth2Client.setCredentials(token);     //set token to oAuth2Client object to proceed next
        // Store the token to disk for next program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        res.redirect(`http://localhost:5000/sendmail`);//move for sending mail
      });
    }
    else{
          console.log("token not found");
          res.redirect(`http://localhost:5000/sendmail`);//move to get token
    }
  }
  else{
    console.log("client not verified");
    res.redirect(`http://localhost:5000/sendmail`);//move to sign in
  }
});


async function sendmessage(oAuth2Client) {
  let msg = null;
  
  //check that proper paramers are passed with link
    if(path==null){                                                    // to Send Mail Without Attachment
      var mailOptions_Without_Attch = {
          from: 'Omkar Kambli <discod748@gmail.com>',
          to:to,
          cc:CC,
          subject:subject,
          text:Body
        };
        
      msg = makeRaw(mailOptions_Without_Attch, function(error, info){
      if (error) {
        console.log(error);
      } 
      else {
        console.log('Email sent: ' + info.response);
        return res.redirect('/result.html')
        //alert("Email Sent")  
      }
    });
    }        
    else{                                                         // to Send Mail With Attachment
      var mailOptions = {
          from: 'Omkar Kambli <discod748@gmail.com>',
          to: to,
          cc:CC,
          subject:subject,
          text:Body,
          attachments: [
            {
             path: path
            }
         ]
        };
      msg=makeRaw(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } 
      else {
        console.log('Email sent: ' + info.response);
         fs.unlink(path,function(err){              // Delete Files Using  file System 
          if(error){
              return res.end(error)
          }else{
              console.log("deleted")
              return res.redirect('/result.html')  
              //alert("Email Sent")    
           }
        })
      }
    });
    }

    
  await gmail.users.messages.send({
      auth: oAuth2Client,               //set verified user's credentials
      userId:'me',                      //set he's user-ID
      'resource': {
        'raw': msg                      //set encoded message
      }
     })
    }
 
app.listen(5000,() => {
  console.log(`App running at http://localhost:5000`);
})

