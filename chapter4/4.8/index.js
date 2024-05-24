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
const data = { foo: 1, bar: 2 }
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

function computed(getter) {
    const effectFn = effect(getter, {
        lazy: true,
        scheduler() {
            console.log('scheduler执行了')
            dirty = true
            /*
             * obj.foo变化时，触发scheduler
             * 进而触发effectSumFunc
             * */
            trigger(computedObj, 'value')
        },
    })
    let value,
        dirty = true
    const computedObj = {
        get value() {
            if (dirty) {
                value = effectFn()
                dirty = false
            }
            // 此时activeEffect是effectSumFunc
            track(computedObj, 'value')
            return value
        },
    }
    return computedObj
}

const sum = computed(() => {
    console.log('计算属性执行了')
    return obj.foo + obj.bar
})

effect(function effectSumFunc() {
    /*
     * sum.value会触发get拦截，然后会触发track函数，此时activeEffect是effectSumFunc
     * */
    console.log(`sum.value=${sum.value}`)
})
