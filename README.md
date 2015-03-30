# charon
![charon](http://conceptartworld.com/wp-content/uploads/2010/04/clash_of_the_titans_03.jpg)

## The Ferryman. He who guides requests in the container underworld.
Charon is DNS. He uses information from derived from the graph database to dynamically resolve ip addresses for container domain names within our system.

### Overview

Charon is responsible for resolving domain names between containers. It resolve names by the requesting container's ip address via the API. Charon is also a specialized DNS, meaning it will ignore queries for non-internal domain names. For example when given a query for `stage-api-codenow.runnableapp.com` (a valid query), the response will look something like this:

```
;; QUESTION SECTION:
;stage-api-codenow.runnableapp.com. IN	A

;; ANSWER SECTION:
stage-api-codenow.runnableapp.com. 0 IN	A	127.0.0.1

;; Query time: 4 msec
;; SERVER: 127.0.0.1#8053(127.0.0.1)
;; WHEN: Mon Mar 30 13:49:11 2015
;; MSG SIZE  rcvd: 67
```

But when given an invalid request, such as `www.google.com`, the response will not contain an answer section:

```
;; QUESTION SECTION:
;google.com.			IN	A

;; Query time: 4 msec
;; SERVER: 127.0.0.1#8053(127.0.0.1)
;; WHEN: Mon Mar 30 13:37:12 2015
;; MSG SIZE  rcvd: 28
```

Charon will **never** attempt to resolve domain names that do not map to internal containers. It literally filters all domains that do not match the appropriate pattern before performing a query. If no names were able to be mapped, a warning will be output in the server logs, like so:

Finally, Charon only supports the resolution of `A` records. Other types of records do not make sense in the context of container ip resolution. This means charon will ignore question types when resolving names. If in the future we require support for other types of records (e.g. `CNAME`) this will change.

```
charon:query:warning No internal container domain names given, skipping.
```

### Testing & Linting
Before pushing changes to master make sure the source lints and tests appropriately:
```
npm run test
```

### Building Documetation
There is an npm task that allows you to build friendly and readable api documentation, here's how to use it:
```
npm run docs
```
Once they have built, simply open the `docs/index.html` page in a browser.

### Running Locally
To run charon locally simply use:
```
DEBUG=charon* npm start
```
You can then use the command `dig` to hit your sever and watch it resolve:
```
dig example.com @localhost -p 8053
```

Note, in development charon runs, by default, on port `8053`.
