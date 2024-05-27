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
function trigger(target, key, type, newValue) {
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

    if (type === 'ADD' || type === 'DELETE') {
        const iterateEffects = depsMap.get(ITERATE_KEY)
        iterateEffects &&
            iterateEffects.forEach((effectFn) => {
                if (effectFn !== activeEffect) {
                    depsToRun.add(effectFn)
                }
            })
    }

    if (type === 'ADD' && Array.isArray(target)) {
        const lengthEffect = depsMap.get('length')
        lengthEffect &&
            lengthEffect.forEach((effectFn) => {
                if (effectFn !== activeEffect) {
                    depsToRun.add(effectFn)
                }
            })
    }

    if (Array.isArray(target) && key === 'length') {
        depsMap.forEach((effects, key) => {
            if (key >= newValue) {
                effects.forEach((effectFn) => {
                    if (effectFn !== activeEffect) {
                        depsToRun.add(effectFn)
                    }
                })
            }
        })
    }

    depsToRun.forEach((effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect)
        } else {
            effect()
        }
    })
}

// 存储副作用函数的桶

const ITERATE_KEY = Symbol()

function createReactive(data, isShallow = false, isReadonly = false) {
    return new Proxy(data, {
        // 拦截读取操作
        get(target, key, receiver) {
            if (key === 'raw') {
                return target
            }
            if (!isReadonly) {
                track(target, key)
            }
            // 返回属性值
            const res = Reflect.get(target, key, receiver)
            if (isShallow) {
                return res
            }
            if (typeof res === 'object' && res !== null) {
                return createReactive(res)
            }
            return res
        },
        // 拦截设置操作
        set(target, key, newVal, receiver) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`)
                return true
            }
            // 设置属性值
            const oldVal = target[key]
            const type = Array.isArray(target)
                ? Number(key) < target.length
                    ? 'SET'
                    : 'ADD'
                : Object.prototype.hasOwnProperty.call(target, key)
                  ? 'SET'
                  : 'ADD'
            const res = Reflect.set(target, key, newVal, receiver)
            if (target === receiver.raw) {
                if (oldVal !== newVal) {
                    trigger(target, key, type, newVal)
                }
            }
            // 返回 true 代表设置操作成功
            return res
        },
        ownKeys(target) {
            track(target, ITERATE_KEY)
            return Reflect.ownKeys(target)
        },
        deleteProperty(target, key) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`)
                return true
            }
            const hasKey = Object.prototype.hasOwnProperty.call(target, key)
            const res = Reflect.deleteProperty(target, key)
            if (hasKey && res) {
                trigger(target, key, 'DELETE')
            }
            return res
        },
    })
}

;(function () {
    const arr = createReactive(['foo', 'bar'])
    effect(() => {
        console.log(arr[0], arr[1]) // depsToRun中添加了2次该副作用函数，因depsToRun是Set，所以实际只添加了一次
    })
    arr.length = 0
})()
