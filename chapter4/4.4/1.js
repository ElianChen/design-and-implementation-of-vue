let activeEffect = null
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn) // 清空依赖
        activeEffect = effectFn
        fn()
    }
    effectFn.deps = []
    effectFn()
}

/**
 * 清理 effectFn 的依赖关系。
 * @param {Function} effectFn - 具有依赖关系的函数，其结构包含一个 deps 数组，用于存储依赖项。
 */
function cleanup(effectFn) {
    // 遍历 effectFn 的所有依赖
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        // 从依赖项中删除 effectFn
        deps.delete(effectFn)
    }
    // 清空 effectFn 的依赖数组
    effectFn.deps.length = 0
}

const bucket = new WeakMap()

function track(target, key) {
    if (!activeEffect) return
    let depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(activeEffect)
    activeEffect.deps.push(deps)
}
function trigger(target, key) {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const deps = depsMap.get(key)
    const depsToRun = new Set(deps)
    depsToRun && depsToRun.forEach((effect) => effect())
}

// 存储副作用函数的桶

// 原始数据
const data = { text: 'hello world', ok: true }
// 对原始数据的代理
const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
        track(target, key)
        // 返回属性值
        return target[key]
    },
    // 拦截设置操作
    set(target, key, newVal) {
        // 设置属性值
        target[key] = newVal
        trigger(target, key)
        // 返回 true 代表设置操作成功
        return true
    },
})
effect(() => {
    console.log('effect run')
    document.body.innerText = obj.ok ? obj.text : 'no'
})

// console.log('副作用函数集合： ', bucket.get(data).get('text'))
// 1秒后修改响应式数据
setTimeout(() => {
    obj.ok = false
    obj.text = ' hello vue3 '
}, 1000)
