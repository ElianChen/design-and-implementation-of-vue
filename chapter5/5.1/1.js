const fn = (name) => {
    console.log(name)
}
const p = new Proxy(fn, {
    apply(target, thisArg, args) {
        console.log(target, thisArg, args)
        return target.apply(thisArg, args)
    },
})

p('zs')

const obj = { foo: 'obj' }
const aha = { foo: 'aha' }
var temp = Reflect.get(obj, 'foo', aha)
console.log(`temp: ${temp}`)

var myObject = {
    foo: 1,
    bar: 2,
    get baz() {
        return this.foo + this.bar
    },
}

var myReceiverObject = {
    foo: 4,
    bar: 4,
}

const sum = Reflect.get(myObject, 'baz', myReceiverObject) // 8
console.log(`sum: ${sum}`)
