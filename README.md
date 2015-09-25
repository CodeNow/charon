# charon
![charon](http://conceptartworld.com/wp-content/uploads/2010/04/clash_of_the_titans_03.jpg)

## The Ferryman. He who guides requests in the container underworld.
Charon is DNS. He uses information from derived from the graph database to
dynamically resolve ip addresses for container domain names within our system.

### Overview

Charon is a [UDP](http://en.wikipedia.org/wiki/User_Datagram_Protocol) based DNS
server that is responsible for resolving domain names between containers. It
runs as an upstart service on each dock and is responsible for resolving
container-to-container names for all containers on that dock.

Name resolutions are given context via the container's local ip address (172.x.y.z),
and the dock's VPC address (10.x.y.z). These values are passed to the API which
performs a lookup in the graph database in an attempt to resolve the name.

Charon is also highly specialized. It will ignore queries for non-container
domain names (e.g. domains that do not match `*.runnableapp.com`). For example
when given a valid query, such as `stage-api-codenow.runnableapp.com`, the
response will look something like this:

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

But when given an invalid query, such as `www.google.com`, the response will not
contain an answer section (i.e. will be empty):

```
;; QUESTION SECTION:
;google.com.			IN	A

;; Query time: 4 msec
;; SERVER: 127.0.0.1#8053(127.0.0.1)
;; WHEN: Mon Mar 30 13:37:12 2015
;; MSG SIZE  rcvd: 28
```

It is important to note that charon will **never** attempt to resolve domain
names that do not map to internal containers. It literally filters all domains
that do not match the appropriate pattern before attempting to resolve names.
If the server is not provided with at least one internal container name to
resolved, it will bypass any resolution attempts and output a warning:

```
[DEBUG] No internal container domain names given, skipping.
```

Finally, Charon only supports the resolution of `A` records, since other types
of records do not make sense in the context of container-to-container ip
resolution. This means charon *ignores question types* when resolving names.
Note: In the future we may require support for other types of records (e.g.
`CNAME`), so this may be subject to change.

### Caching
Charon uses a multi-key in-memory LRU cache to quickly resolve records that
have been previously requested. The cache has a maximum size determined by
`process.env.CACHE_MAX_ENTRIES` (each entry is roughly 500 bytes).

To monitor the health of the cache charon increments the following counters
in datadog:

* `charon.cache.hit` - Number of cache hits per time period
* `charon.cache.miss` - Number of cache misses per time period
* `charon.cache.set` - Number of cache entries set per time period
* `charon.cache.invalidate` - Number of cache invalidations per time period

Entries in the cache are keyed by both the domain name requested and the
referrer ip address. This allows us to invalidate entire swaths of entries
by either name or referrer address.

Currently cache invalidations are only performed by referrer address. This is
achieved by listening to pubsub events on redis with the event key provided in
`process.env.REDIS_INVALIDATION_KEY`.

### Testing & Linting
Before pushing changes to master make sure the source lints and tests
appropriately:

```
npm run test
```

### Building Documetation
There is an npm task that allows you to build friendly and readable api
documentation, here's how to use it:

```
npm run docs
```

Once they have built, simply open the `docs/index.html` page in a browser.


### Deploying to Staging
Since charon cannot exist within the context of our staging sandbox we need to
deploy it on an outside server. This requires that we link the various hosts
and ports to their sandbox equivalents via the command-line when performing
the staging deploy.

Specifically you will need the following:

* `datadog_host` - The host for **datadog** in our sandbox,
* `datadog_port` - The port for **datadog** in our sandbox,
* `redis_host` - The host for the **Redis** server in our staging sandbox.
* `redis_port` - The port for the **Redis** server in our staging sandbox.

The resulting command will look something like this:

```
ansible-playbook -i ./stage-hosts -e datadog_host=10.0.1.10 \
                 -e datadog_port=32854 -e redis_host=10.0.1.210 \
                 -e redis_port=33129 \
                 charon.yml
```

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
