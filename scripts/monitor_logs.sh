#!/usr/bin/expect

set timeout 20
set host "45.85.146.77"
set user "root"
set password "*Giuseppe78"

spawn ssh $user@$host "pm2 list"

expect {
    "yes/no" { send "yes\r"; exp_continue }
    "password:" { send "$password\r" }
}

expect eof
