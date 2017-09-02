/**
 * UserController
 *
 * @description :: Server-side logic for managing User creation, retrieval(Authentication), deletion, and updating.
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

 const crypto = require('crypto');
 const bcrypt = require('bcrypt');

 // get messages.
 var get_success_msg       = 'Logged In';
 var get_failure_msg       = 'Invalid username or password.';

 // create messages.
 var uname_regexp          = /^[a-zA-Z0-9_-]{3,26}$/
 var pword_regexp          = /^((?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W]).{8,50})$/
 var uname_invalid_msg     = 'Username must be between 3 and 26 characters long, and can only contain alphanumerical, \'-\' and \'_\'';
 var pword_invalid_msg     = 'Password must contain 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.';
 var user_exists_msg       = 'User already exists with that username.';
 var user_created_msg      = 'Succesfully Created Account';

 // Destroy/Update messages.
 var account_updated_msg   = 'Account succesfully updated. If you changed your password, you will need to re-login on your devices.';
 
 // Auth messages.
 var device_unauth_msg     = 'This device is not authorised to perform that action.';

module.exports = {

    /* 'post /unet/user/get'
     * Retrieves a User Model if authenticated.
     * 
     * Returns json:
     * {
     *     err: [ true | false ],
     *     warning: [ true | false ],
     *     msg: Error, Warning or Success message; E.G. [ 'Incorrect username or password' ],
     *     exists: [ true | false ],
     *     token: Authentication token,
     *     user: User.js model
     * }
     *
     */
    get: function (req, res) {
        // Parse POST for User params.
        var uname  = req.param('username');
        var pword  = req.param('password');

        // Look up User.
        User.findOne({
            username: uname
        }).exec((err, user) => {
            if (err) return res.json(Utils.return_error(err));
            if (user) {
                // Check Password matches database password.
                bcrypt.compare(pword, user.password, (err, match) => {
                    if (err) return res.json(Utils.return_error(err));
                    if (match) {
                        // Generate an auth token.
                        crypto.randomBytes(256, (err, buf) => {
                            if (err) return res.json(Utils.return_error(err));
                            // Create a new Device for this account to be authenticate to.
                            Device.create({
                                owner: user.id,
                                ip: req.ip,
                                user_agent: req.headers['user-agent'],
                                token: buf.toString('hex')
                            }).exec(function(err, newDevice) {
                                // Update the User with this new device.
                                User.find().populate('devices').exec((err, popdUsers) => {});
                            });
                            // Return User.
                            return res.json({
                                err: false,
                                warning: false,
                                msg: get_success_msg,
                                exists: true,
                                token: buf.toString('hex'),
                                user: user
                            });
                        });
                    } else {
                        return res.json({
                            err: false,
                            warning: true,
                            msg: get_failure_msg,
                            exists: null,
                            token: null,
                            user: null
                        });
                    }
                });
            } else {
                return res.json({
                    err: false,
                    warning: true,
                    msg: get_failure_msg,
                    exists: null,
                    token: null,
                    user: null
                });
            }
        });
    },

    /* 'post /unet/user/create'
     * Check if a user exists under post param "username". If not, creates a new one.
     * 
     * Returns json:
     * {
     *     err: [ true | false ],
     *     warning: [ true | false ],
     *     msg: Error, Warning or Success message; E.G. [ 'User already exists' | 'Password must contain 1 uppercase' ]
     *     exists: [ true | false ],
     *     user: User.js model
     * }
     *
     */
    create: function (req, res) {
        // Parse POST for User params.
        var uname  = req.param('username');
        var pword  = req.param('password');

        // Check username is valid.
        if (uname.search(uname_regexp) == -1) {
            return res.json({
                err: false,
                warning: true,
                msg: uname_invalid_msg,
                exists: null,
                user: null
            });
        }

        // Check password is valid.
        if (pword.search(pword_regexp) == -1) {
            return res.json({
                err: false,
                warning: true,
                msg: pword_invalid_msg,
                exists: null,
                user: null
            })
        }

        // Check if a User exists under this username already.
        User.findOne({
            username: uname
        }).exec((err, user) => {
            // Error; return error to client app.
            if (err) return res.json(Utils.return_error(err));
            // If the user exists.
            if (user) {
                return res.json({
                    err: false,
                    warning: true,
                    msg: user_exists_msg,
                    exists: true,
                    user: null
                });
            } else {
                User.create({
                    username: uname,
                    password: pword
                }).exec((err, user) => {
                    // Error; return error to client app.
                    if (err) return res.json(Utils.return_error(err));
                    /* @TODO Initialise Account models, for example Profile/Upload Directory etc */
                    return res.json({
                        err: false,
                        warning: false,
                        msg: user_created_msg,
                        exists: false,
                        username: user.username,
                        id: user.id
                    });
                });
            }
        });
    },

    /* 'post /unet/user/destroy'
     * Destroys a User model if requested is authenticated.
     * 
     * Returns json:
     * {
     *     err: [ true | false ],
     *     warning: [ true | false ],
     *     msg: Error, Warning or Success message; E.G. [ 'Account Deleted.' ],
     *     exists: [ true | false ],
     *     user: User.js model
     * }
     *
     */
    destroy: function (req, res) {
        // Parse POST for User params.
        var authToken = req.param('token');
        // Check and see if a Device with this AuthToken exists.
        Device.findOne({
            token: authToken
        }).exec((err, device) => {
            if (err) return res.json(Utils.return_error(err));
            if (device) {
                // Remove the User model from the table. User model will delete its dependent children.
                User.destroy({
                    id: device.owner
                }).exec((err) => {
                    if (err) return res.json(Utils.return_error(err));
                    else return res.json({
                        err: false,
                        warning: false,
                        msg: 'Account Deleted.',
                        exists: false,
                        user: null
                    });
                });
            } else {
                return res.json({
                    err: false,
                    warning: true,
                    msg: device_unauth_msg,
                    exists: null,
                    token: null,
                    user: null
                });
            }
        });
    },

    /* 'post /unet/user/update'
     * Updates info on a User model if request is authenticated.
     * 
     * Returns json:
     * {
     *     err: [ true | false ],
     *     warning: [ true | false ],
     *     msg: Error, Warning or Success message; E.G. [ 'Account Updated', 'Invalid new Password' ],
     *     exists: [ true | false ],
     *     user: User.js model
     * }
     */
    update: function (req, res) {
        // Parse POST for User params.
        var authToken   = req.param('token');
        var newPassword = req.param('password');
        // Check the request is authenticted.
        Device.findOne({
            token: authToken
        }).exec((err, device) => {
            if (err) return res.json(Utils.return_error(err));
            if (device) {
                // Check new password is valid.
                if (newPassword.search(pword_regexp) == -1) {
                    return res.json({
                        err: false,
                        warning: true,
                        msg: pword_invalid_msg,
                        exists: null,
                        user: null
                    });
                } else {
                    // Hash the password.
                    bcrypt.hash(valuesToUpdate.password, 10, function(err, hash) {
                        if(err) return res.json(Utils.return_error(err));
                        // Update desired User model with new data.
                        User.update(
                            {id: device.owner},
                            {password: hash}
                        ).exec((err) => {
                            if (err) return res.json(Utils.return_error(err));
                            else return res.json({
                                err: false,
                                warning: false,
                                msg: account_updated_msg,
                                exists: false,
                                user: null
                            }); 
                        });
                    });
                }
            } else {
                return res.json({
                    err: false,
                    warning: true,
                    msg: device_unauth_msg,
                    exists: null,
                    token: null,
                    user: null
                });
            }
        });
    }
	
};

/* @TODO : Will queue IO operations involved with deleting a User.
 *  E.G. Deleting files.
 */
function deleteUser(userID) {
    // @TODO
}
