//jshint esversion:6

const express = require("express");
const { urlencoded } = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const dotenv = require('dotenv').config();
const rateLimit = require('express-rate-limit');

const app = express();
const username = process.env.USERNAME;
const password = process.env.PASS;
const address = process.env.ADDRESS;

const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 delete requests per windowMs
});

app.set('view engine', 'ejs');

app.use(urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect('mongodb+srv://' + username + ':' + password + '@' + address + '.mongodb.net/todolistDB', { useNewUrlParser: true, useUnifiedTopology: true });

const itemsSchema = {
  name: String
};

const Item = mongoose.model('Item', itemsSchema);

const item1 = new Item ({
  name: 'Welcome to your todo list.'
});

const item2 = new Item ({
  name: 'Hit the +.'
});

const item3 = new Item ({
  name: '<<== Hit to delete.'
});

const defaultItems = [item1, item2, item3];

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model('List', listSchema);

function isValidListName(name) {
  // Allow only letters, numbers, spaces, underscores, and hyphens
  return typeof name === 'string' && /^[A-Za-z0-9 _-]+$/.test(name);
}

app.get("/", function(req, res) {

  Item.find({}, (err, foundItems) => {

    if (foundItems.length === 0) {
      Item.insertMany(defaultItems, (err) => {
        if (err) console.log(err)
        else console.log('Successfully Added to database.');
      });
      res.redirect('/');
    } else {
        res.render("list", {listTitle: 'Today', newListItems: foundItems});
    }

  });

});

app.get('/:customListName', (req, res) => {
  const customListName = _.capitalize(req.params.customListName);

  if (!isValidListName(customListName)) {
    return res.redirect('/');
  }

  List.findOne({name: customListName}, (err, foundList) =>{
    if (!err) {
      if (!foundList) {
        const list = new List ({
          name: customListName,
          items: defaultItems
        });
      
        list.save();

        res.redirect('/' + customListName);
      } else {
        res.render('list', {listTitle: foundList.name, newListItems: foundList.items});
      }

    }

  });
  
});

app.post("/", function(req, res){

  const itemName = req.body.newItem;
  const safeListName = sanitizeListName(req.body.list);

  if (!safeListName) {
    return res.redirect('/');
  }

  const item = new Item ({
    name: itemName
  });

  if (safeListName === 'Today') {
    item.save();
    res.redirect('/');
  } else {
    List.findOne({name: safeListName}, (err, foundList) => {
      if (foundList) {
        foundList.items.push(item);
        foundList.save();
      }
      res.redirect('/' + safeListName);
    });
  }
});

function sanitizeListName(rawName) {
  if (typeof rawName !== 'string') {
    return null;
  }

  const trimmed = rawName.trim();

  // Allow only letters, numbers, spaces, and basic punctuation used in list names.
  // Disallow characters that could lead to protocol-relative or absolute URLs.
  const isValid = /^[A-Za-z0-9 _-]{1,100}$/.test(trimmed);

  if (!isValid) {
    return null;
  }

  return trimmed;
}

app.post('/delete', deleteLimiter, (req, res) => {
  const checkedItemId = req.body.checkbox;
  const safeListName = sanitizeListName(req.body.listName);

  if (!safeListName) {
    return res.redirect('/');
  }

  if (safeListName === 'Today') {
    Item.findByIdAndRemove(checkedItemId, (err) => {
      if (!err) {
        console.log('Successfully deleted checked item.');
        res.redirect('/');
      }
    });
  } else {
    List.findOneAndUpdate(
      {name: safeListName},
      {$pull: {items: {_id: checkedItemId}}},
      (err, foundList) => {
        if (!err) {
          res.redirect('/' + safeListName);
        }
      }
    );
  }
});

app.get("/about", function(req, res){
  res.render("about");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server has started successfully.");
});
