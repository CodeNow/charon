# charon
![charon](http://conceptartworld.com/wp-content/uploads/2010/04/clash_of_the_titans_03.jpg)

## The Ferryman. He who guides requests in the container underworld.
Charon is DNS. He uses information from derived from the graph database to dynamically resolve ip addresses for container domain names within our system.

### Running Locally
To run charon locally simply use:
```
DEBUG=charon* npm start
```
You can then use `dig` to hit your sever and watch it resolve:
```
dig example.com @localhost -p 8053
```

### Testing & Linting
Before pushing changes to master make sure the source lints:
```
npm run lint
```
And passes all tests:
```
npm run test
```

