# Integration tests Agent Guide

- Test here only interactions between both adapters; test a single adapter's behavior in that adapter's package.
- Give each client on a shared cache a distinct nonempty prefix, unless the test targets unprefixed clients.
