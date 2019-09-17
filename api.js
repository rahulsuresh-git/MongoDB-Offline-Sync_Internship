const express = require('express');
const router = express.Router();
const axios = require('axios')

const MongoClient = require('mongodb').MongoClient;

const localClient = new MongoClient(process.env.LOCAL_DB_URL, {
    useNewUrlParser: true
});
// const remoteClient = new MongoClient(process.env.REMOTE_DB_URL, {
//     useNewUrlParser: true
// });
var mongoClient;
var tunnel = require('tunnel-ssh');
var localDb;
// var remoteDb;
var mongoDb;


var config = {
//DATA HIDDEN DUE TO SECURITY REASONS
};
tunnel(config, function (error, server) {
    if (error) {
        console.log("SSH connection error: " + error);
    }

    mongoClient = new MongoClient('DATA HIDDEN DUE TO SECURITY REASONS' + process.env.MONGO_SERVER_NAME + '/' + process.env.MONGO_DB_NAME, {
        useNewUrlParser: true
    });
    mongoClient.connect(function (err, database) {
        if (err) {

            console.error(err)
        }

        console.log("Connected successfully to " + "MONGO STAGING");
        mongoDb = database.db(process.env.MONGO_DB_NAME);
    });

});




localClient.connect(function (err, database) {
    if (err) {
        console.error(err)
    }

    console.log("Connected successfully to " + process.env.LOCAL_DB_NAME + " server");
    localDb = database.db(process.env.LOCAL_DB_NAME);
});


//gets common collections between local and staging
async function getCommonCollections() {
    var serverAll = mongoDb.listCollections();
    var localAll = localDb.listCollections();

    var serverResults = [];
    var localResults = [];

    await serverAll.forEach(function (collectionName) {
        serverResults.push(collectionName.name);
    });
    await localAll.forEach(function (collectionName) {
        localResults.push(collectionName.name);
    });

    var newArr = [];
    newArr = serverResults.filter(function (v) {
        return localResults.indexOf(v) >= 0;
    })
    newArr.concat(localResults.filter(function (v) {
        return newArr.indexOf(v) >= 0;
    }));
    return newArr;
}

//POST
//pushes data to local collection with synced flag, modify data json as per your organization
router.post('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', async (req, res) => {
    var collection = req.body.collection;
    const col = localDb.collection(collection);
    const data = {
        value: req.body.value,
        updated_on: new Date(),
        synced: false
    }
    await col.insert(data, (req, res) => {
        console.log("inserted success");

    })
    res.status(200).send({
        "status": "success"
    });
})

//GET
//if called, gets all the common db between local and staging and hard resets them. (hard reset=delete from local and get from server)
router.get('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', async (req, res) => {
    var newArr = await getCommonCollections();
    console.log(newArr);
    await newArr.forEach(async function (collectionName) {
        var coll = String(collectionName);
        
        await axios.post(`http://localhost:3001/api/ENDPOINT HIDDEN DUE TO SECURITY REASONS`, {
                collection:coll
            })
            .then(res => {
                console.log(res.data);
            });
    });
    res.status(200).send({
        "status": "success"
    });
})

//GET
//sync latest updated at server to local (pull)
//updates last_pulled time in local info collection
router.get('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', async (req, res) => {

    var newArr = await getCommonCollections();
    const localInfo = localDb.collection('info');
    await newArr.forEach(async function (collectionName) {


        let localCol = localDb.collection(collectionName);
        let serverCol = mongoDb.collection(collectionName);

        await localInfo.find({}).toArray(async (err, docs) => {

            var lastPullTime = docs[0].last_pulled;
            console.log("Last pull time :" + lastPullTime);

            await serverCol.find({
                updated_on: {
                    "$gte": lastPullTime
                }
            }).count(function (err, res) {
                if (err)
                    console.log("some error occured");
                else {
                    console.log("Number of records to be synced for ", collectionName, ": ", res)
                }
            });

            await serverCol.find({
                updated_on: {
                    "$gte": lastPullTime
                }
            }).toArray(async (err, docs) => {
                docs.forEach(async (docs) => {
                    await localCol.update({
                        _id: docs._id
                    }, docs, {
                        upsert: true
                    }, async (err, task) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log("Data updated at Local from Server");

                        await localInfo.find({}).toArray(async (err, docs) => {
                            var syncTime = new Date();
                            console.log("Updated pull time" + syncTime);
                            await localInfo.update({
                                _id: docs[0]._id
                            }, {
                                $set: {
                                    last_pulled: syncTime
                               }
                            });
                        })

                    });
                })
            })


        })
        console.log("Synced data from server to local for ", collectionName);
    });

    // try {
    //     col = localDb.collection('DATA HIDDEN DUE TO SECURITY REASONS');
    // } catch (e) {
    //     console.log("local test already deleted");
    // }
    res.status(200).send({
        "status": "success"
    });
});

//GET
//sync latest updated at local to server (push)
//updates last_pushed time in local info collection
router.get('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', async (req, res) => {

    var newArr = await getCommonCollections();
    const localInfo = localDb.collection('info');
    await newArr.forEach(async function (collectionName) {


        let localCol = localDb.collection(collectionName);
        let serverCol = mongoDb.collection(collectionName);

        await localCol.find({
            synced: false
        }).count(function (err, res) {
            if (err)
                console.log("some error occured");
            else {
                console.log("Number of records to be synced from Local to Server for ", collectionName, " : ", res);
            }
        });


        await localCol.find({
            synced: false
        }).project({
            synced: 0
        }).toArray(async (err, docs) => {
            docs.forEach(async (docs) => {
                await serverCol.update({
                    _id: docs._id
                }, docs, {
                    upsert: true
                }, async (err, task) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log("Data Updated at server");

                        await localCol.update({
                            _id: docs._id
                        }, {
                            $set: {
                                synced: true
                            }

                        })

                        await localInfo.find({}).toArray(async (err, docs) => {
                            var syncTime = new Date();
                            console.log(syncTime);
                            await localInfo.update({
                                _id: docs[0]._id
                            }, {
                                $set: {
                                    last_pushed: syncTime
                                }
                            });
                        })
                    }



                });
            })
        })



    });

    res.status(200).send({
        "status": "success"
    });

})

//POST
//helper function for /ENDPOINT HIDDEN DUE TO SECURITY REASONS GET api (dont touch this)  {expects {collection:"collection name"} 
//and hard resets it, if it doesnt exist in local, then creates it}
//Also, it updates last_pulled time local info collection
router.post('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', (req, res) => {

    var collection = req.body.collection;
    let col;
    try {
        col = localDb.collection(collection);
        col.drop(function (err, res) {
            if (err) {
                console.log(collection, " doesnt exist")
            } else {
                console.log(collection, "detected and dropped");
            }
        });
    } catch (e) {
        console.log(collection, " doesnt exist");
    } finally {
        col = localDb.createCollection(collection);
        col = localDb.collection(collection);

        const col2 = localDb.collection('info');
        console.log("created new ", collection, "at local");

        const ser = mongoDb.collection(collection, function (err, res) {
            if (err) {
                console.log(collection, "not found in server, please check!");
                return;
            }
        });
        col2.find({}).toArray((err, docs) => {
            if (err)
                console.log("please create info table at local");
            ser.find({
                application_id: process.env.APPLICATION_ID,
            }).count(function (err, res) {
                if (err)
                    console.log(err, "error fetching from server db");
                else {
                    console.log("total records to be loaded :", res);
                }
            });
            ser.find({
                application_id: process.env.APPLICATION_ID,
            }).toArray((err, docs) => {
                var count = 0;
                console.log("please wait...loading into local");
                col.insertMany(docs).then(() => {
                    console.log("success");

                    col2.find({}).toArray((err, docs) => {
                        var syncTime = new Date();
                        console.log("Updated pull time" + syncTime);
                        col2.update({
                            _id: docs[0]._id
                        }, {
                            $set: {
                                last_pulled: syncTime
                            }
                        });
                    });
                    res.status(200).send({
                        "status": "success"
                    });
                });

            })
        })
    }
});


//GET
//Entry point API
router.get('/ENDPOINT HIDDEN DUE TO SECURITY REASONS', async (req, res) => {
    try {
        col = await localDb.collection('info');
        col.drop(function (err, res) {
            if (err) {
                console.log("info doesnt exist")
            } else {
                console.log("info detected and dropped");
            }
        });
    } catch (e) {
        console.log(collection, " doesnt exist");
    } finally {
        let col = await localDb.createCollection('info');
        col = localDb.collection('info');
        const data = {
            last_pushed: new Date(),
            last_pulled: new Date(),
        }
        await col.insert(data, (req, res) => {
            console.log("inserted success");

        })
        res.status(200).send({
            "status": "success"
        });
    }
})


module.exports = router;

