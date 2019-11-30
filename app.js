var express 		= require('express'),
	app 			= express(),
	methodOverride 	= require('method-override'), 
	bodyParser  	= require('body-parser'),
	jsdom 			= require('jsdom'),
	mongoose 		= require('mongoose'),
	passport 		= require('passport'),
	Holidays 		= require('date-holidays'),
	localStrategy 	= require('passport-local');

/* Calender stuffs
var hd = new Holidays();
hd.init('US', 'la', 'no');
var a = hd.getHolidays(2016)
console.log(a[0]);
*/

//------------------------//
// IMPORT Objects         //
//------------------------//
var Student = require('./models/student');
var Faculty = require('./models/faculty');
var Assignment = require('./models/assignment');

//------------------------//
// Jquery                 //
//------------------------//
const { JSDOM } = jsdom;
const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;
var $ = require("jquery")(window);


//------------------------//
// Mongoose/Model Config  //
//------------------------//
// Tell Express to listen for requests (start server)
mongoose.connect('mongodb://localhost/BBProject', {
	useNewUrlParser: true, 
	useUnifiedTopology: true,
	useCreateIndex: true
}).then(() => {
	console.log('Connect to DB!');
}).catch(err => {
	console.log('ERROR:', err.message);
}); 


//------------------------//
// Basic config           //
//------------------------//
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));


//-----------------------//
// Passport Config       //
//-----------------------//
	/*Useful resources:
	• https://stackoverflow.com/questions/27637609/understanding-passport-serialize-deserialize 
	• https://stackoverflow.com/questions/45897332/passport-js-multiple-de-serialize-methods
	*/

app.use(require('express-session')({
		secret:'Halloween is the BEST!@#$',
		resave: false,
		saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use('faculty', new localStrategy(Faculty.authenticate()));
passport.use('student', new localStrategy(Student.authenticate()));

passport.serializeUser((obj, done) => {
	console.log(obj instanceof Student);
  if (obj instanceof Student) {
    done(null, {id: obj._id, type: 'Student' });
  } else {
    done(null, {id: obj._id, type: 'Faculty' });
  }
});

passport.deserializeUser(function(obj, done) {
    if (obj.type === 'Student') {
		Student.findById(obj.id, function(err, student) {
        done(err, student)});
  	} else {
		Faculty.findById(obj.id, function(err, faculty) {
        done(err, faculty)});
	}
});


app.use(function(req, res, next){
	res.locals.currentUser = req.user;
	next();
});

//-----------------------------//
// REGULAR ROUTES (front-end)  //
//-----------------------------//
// ROOT Page Route
app.get('/home', isLoggedIn, function(req, res){
	res.render('home');
});

app.get('/', isLoggedIn, function(req, res){
	res.render('home');
});

//-----------------------------   //
// RESTFUL ROUTES for ASSIGNMENTS //
//-----------------------------   //

// INDEX route (show all assignments)
app.get('/assignment', function(req, res){
	Assignment.find({}, function(err, allAssignments){
		if(err) {
			console.log("Error!");
		} else {
			res.render('assignment/index', {assignment:allAssignments});
		}
	});	
});


// NEW route (input form)
app.get('/assignment/new', isLoggedIn, function(req, res){
	res.render('assignment/new');
});


// CREATE route (add the new assignment into our db)
app.post('/assignment', isLoggedIn, function(req, res){
	// Create assignment
	Assignment.create(req.body.assignment, function(err, newAssignment){
		if(err){
			res.render('new');
		} else {
			res.redirect('/assignment');
		}
	})
});


// SHOW route (show the detail info of a specific assignment)
app.get('/assignment/:id', function(req, res){
	var userTypeStudent = req.user instanceof Student;
	var userTypeFaculty = req.user instanceof Faculty;
	console.log("Faculty:");
	console.log(userTypeFaculty);
	console.log("Student:");
	console.log(userTypeStudent);
	
	Assignment.findById(req.params.id, function(err, foundAssignment){
		if(err) {
			console.log("Cannot find the requested assignment");
			res.redirect('/assignment');
		} else {
			res.render('assignment/show', {assignment:foundAssignment, userTypeStudent:userTypeStudent, userTypeFaculty:userTypeFaculty});
		}
	});
});


// EDIT route (input form)
app.get('/assignment/:id/edit', isLoggedIn, function(req, res){
	Assignment.findById(req.params.id, function(err, foundAssignment){
		if(err) {
			console.log('cannot find the assignment to edit')
			res.redirect('/assignment');
		} else{
			res.render('assignment/edit', {assignment:foundAssignment});
		}
	})
});


// UPDATE route (update the edited input into our db)
app.put('/assignment/:id', isLoggedIn, function(req, res){
	Assignment.findByIdAndUpdate(req.params.id, req.body.assignment, function(err, updateAssignment){
		if(err){
			res.redirect('/assignment');
		} else {
			res.redirect('/assignment/' + req.params.id);
		}
	});
});


// DELETE route (remove data from the db)
app.delete('/assignment/:id', isLoggedIn, function(req, res){
	Assignment.findByIdAndRemove(req.params.id, function(err){
		if(err){
			console.log('Delete fail!');
			res.redirect('/assignment');
		} else {
			res.redirect('/assignment');
		}
	});
});

//-----------------------------//
// AUTH ROUTES				   //
//-----------------------------//

// ---------- LOG-IN
//	1. Show the login form
app.get('/login', function(req, res){
	res.render('login');
});


app.post('/login', logIn, function(req, res) {
});

// ---------- REGISTER
// Show the register form
app.get('/register', function(req, res){
	res.render('register');
});

// handle register logic
app.post('/register', function(req, res) {
	console.log(req.body.accountType);
	
	if (req.body.accountType === 'student') {
		var newStudent = new Student({username: req.body.username});
		Student.register(newStudent, req.body.password, function(err, student){
			if(err){
				console.log("can't register!");
				console.log(err);
				return res.render('register');
			}

			// If the student successfully signup, he will be login
			passport.authenticate('student')(req, res, function(){
				res.redirect('/home');
			});
		});
		
	} else if (req.body.accountType === 'faculty') {
		var newFaculty = new Faculty({username: req.body.username});
		Faculty.register(newFaculty, req.body.password, function(err, faculty){
			if(err){
				console.log("can't register!");
				console.log(err);
				return res.render('register');
			}

			// If the Faculty successfully signup, he will be login
			passport.authenticate('faculty')(req, res, function(){
				res.redirect('/home');
			});
		});
	}
	
});

// ----------- LOG OUT
app.get('/logout', function(req, res){
	req.logout();
	res.redirect('/login');
});
 
// Middleware function
function isLoggedIn(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	res.redirect('/login');
}

function logIn(req, res, next){
	console.log(req.body.accountType);
	if(req.body.accountType === 'faculty') {
		passport.authenticate('faculty')(req, res, function(){
			res.redirect('/home');
		});
		
	} else if(req.body.accountType === 'student') {
		passport.authenticate('student')(req, res, function(){
			res.redirect('/home');
		});
	}
	return next();
}

//-----------------------------//
// NODE Connection/START       //
//-----------------------------//
const port = process.env.PORT || 3000;
const ip = process.env.IP || "127.0.0.1";
app.listen(port, function(){
    console.log("Server has started .... at port "+ port + " ip: " + ip);
});






