import { Octokit } from "@octokit/rest";
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import { error } from "node:console";

const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors({
  origin: ['https://onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.static('public'));

const octokit = new Octokit();

const pool = mysql.createPool({
    host: process.env.DB_HOST,

    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
        port:process.env.DB_PORT,
     ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
console.log("Database connection pool initialized");
const port=process.env.PORT || 3000;
app.listen(port, () => {
    console.log('Port running on http://localhost:3000');
});

function calLastmod(date) {
    const LastD = new Date(date);
    const newD = new Date();
    const differenceInMs = newD - LastD;
    const msInADay = 1000 * 60 * 60 * 24;
    return Math.floor(differenceInMs / msInADay);
}

function getUname(giturl) {
    try {
        const Url = new URL(giturl);
        if (Url.hostname !== 'github.com') {
            return 'false url';
        }
        const name = Url.pathname.split('/').filter(Boolean);
        return name[0] || 'false url'; 
    } catch (e) {
        return 'false url'; // Handles malformed URLs that crash the URL parser
    }
}

app.post('/', async (req, res) => {
    const { url } = req.body;
    const uname = getUname(url);

    if (uname === 'false url') {
        // Tip: 505 is an HTTP Version Not Supported error code. 400 is cleaner for bad inputs.
        return res.status(400).json({
            msg: "Invalid GitHub URL provided",
            error: true
        });
    }

    try {
        const { data: profile } = await octokit.rest.users.getByUsername({ username: uname });
        
   
        const avail = profile.twitter_username ? true : false;
        
        const last = calLastmod(profile.updated_at);
        const lastm = last.toString() + ' day(s)';
        
        const isAc = last <= 200;

        // 🛠️ FIX 3: GitHub calls this property 'public_repos', not 'repcount'.
        const info = [
            uname,
            profile.public_repos, // Fixed property name
            profile.followers,
             profile.following,
            avail,
            isAc,    
             lastm,
             profile.avatar_url
        ];

        
        await pool.query('INSERT INTO gitinfo VALUES (?, ?, ?, ?, ?, ?, ?,?)', info);
        console.log('Data successfully inserted into MySQL');
        
        res.status(200).json({
            error: false,
            msg: "Data inserted successfully"
        });

    } catch (apiOrDbError) {
        console.error("Execution error:", apiOrDbError.message);
        res.status(500).json({
            error: true,
            msg: apiOrDbError.message
        });
    }
});

// GET endpoints ready for your implementation
app.get('/all', async (req, res) => {
   
    const [rows] = await pool.query('SELECT * FROM gitinfo');
    res.status(200).json({
        error:false,
        data:rows
    });
});

app.get('/:username', async (req, res) => {
   
    const [rows] = await pool.query('SELECT * FROM gitinfo WHERE username = ?', [req.params.username]);
    res.status(200).json({
        error:false,
        data:rows
    });
});
