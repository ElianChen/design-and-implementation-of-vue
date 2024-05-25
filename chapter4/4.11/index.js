let activeEffect = null
const effectStack = []
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn) // 清空依赖
        // effect嵌套的处理 *开始*
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        // effect嵌套的处理 *结束*
        return res
    }
    effectFn.options = options
    effectFn.deps = []
    if (!options.lazy) {
        effectFn()
    }
    return effectFn
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
    const depsToRun = new Set()
    deps &&
        deps.forEach((effectFn) => {
            // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，
            // 则不触发执行
            if (effectFn !== activeEffect) {
                depsToRun.add(effectFn)
            }
        })

    depsToRun.forEach((effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect)
        } else {
            effect()
        }
    })
}

// 存储副作用函数的桶

// 原始数据
const data = {
    foo: 1,
    bar: 2,
    a: {
        b: 1,
    },
}
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

function traverse(value, seen = new Set()) {
    // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
    seen.add(value)
    // 暂时不考虑数组等其他结构
    // 假设 value 就是一个对象，使用 for...in 读取
    for (const key in value) {
        traverse(value[key], seen)
    }
    return value
}

function watch(source, cb, options) {
    let getter, oldValue, newValue
    if (typeof source === 'function') {
        /*
        在getter函数内部，
        用户可以指定该watch依赖哪些响应式数据，
        只有当这些数据变化时，
        才会触发回调函数执行
        */
        getter = source
    } else {
        getter = () => traverse(source)
    }
    let cleanup
    function onInvalidate(fn) {
        cleanup = fn
    }
    const job = () => {
        newValue = effectFn()
        if (cleanup) {
            cleanup()
        }
        cb(newValue, oldValue, onInvalidate)
        oldValue = newValue
    }
    const effectFn = effect(() => getter(), {
        lazy: true,
        scheduler() {
            if (options?.flush === 'post') {
                const p = Promise.resolve()
                p.then(job)
            } else {
                job()
            }
        },
    })
    if (options?.immediate) {
        job()
    } else {
        oldValue = effectFn()
    }
}

watch(obj, async (newValue, oldValue, onInvalidate) => {
    let expired = false
    onInvalidate(() => {
        expired = true
    })
    await new Promise((resolve) => {
        setTimeout(resolve, 1000)
    })
    if (!expired) {
        console.log(`现在的foo值是${newValue.foo}`)
    }
})

obj.foo++
setTimeout(() => {
    obj.foo++
}, 200)
