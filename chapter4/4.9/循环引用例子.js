let objA = {}
let objB = {}

// 形成循环引用
objA.ref = objB
objB.ref = objA

function simpleTraverse(obj) {
    for (let key in obj) {
        console.log(key)
        // 如果不加以判断，这里会无限遍历objA和objB
        simpleTraverse(obj[key])
    }
}

// 调用函数会导致死循环
simpleTraverse(objA)
