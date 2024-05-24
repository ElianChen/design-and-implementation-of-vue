# 问题
```js
const data = {
    foo: 1,
    bar: 2,
    a: {
        b: 1,
    },
}
```
修改data.a.b不会触发watch
