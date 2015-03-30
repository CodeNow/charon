# charon
![charon](http://conceptartworld.com/wp-content/uploads/2010/04/clash_of_the_titans_03.jpg)

## The Ferryman. He who guides requests in the container underworld.
Charon is DNS. He uses information from derived from the graph database to dynamically resolve ip addresses for container domain names within our system.

### Overview

Charon is a [UDP](http://en.wikipedia.org/wiki/User_Datagram_Protocol) based DNS server that is responsible for resolving domain names between containers. Name resolution is contextualized by way of the requesting container's IP address, and actual lookups are performed by querying the graph database through the API.

Charon is also a specialized DNS, meaning it will ignore queries for non-container domain names (e.g. domains that do not match `*.runnableapp.com`). For example when given a valid query, such as `stage-api-codenow.runnableapp.com`, the response will look something like this:

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

But when given an invalid query, such as `www.google.com`, the response will not contain an answer section (i.e. will be empty):

```
;; QUESTION SECTION:
;google.com.			IN	A

;; Query time: 4 msec
;; SERVER: 127.0.0.1#8053(127.0.0.1)
;; WHEN: Mon Mar 30 13:37:12 2015
;; MSG SIZE  rcvd: 28
```

It is important to note that charon will **never** attempt to resolve domain names that do not map to internal containers. It literally filters all domains that do not match the appropriate pattern before attempting to resolve names. If the server is not provided with a single name to be resolved, the server will bypass any resolution attempts, and output a warning in the logs:

```
charon:query:warning No internal container domain names given, skipping.
```

Finally, Charon only supports the resolution of `A` records, since other types of records do not make sense in the context of container-to-container ip resolution. This means charon will ignore question types when resolving names. If in the future we may require support for other types of records (e.g. `CNAME`).


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
