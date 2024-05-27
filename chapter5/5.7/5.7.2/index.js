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
    if (!activeEffect || !shouldTrack) return
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
const arrayInstrumentations = {}
let shouldTrack = true
;['includes', 'indexOf', 'lastIndexOf'].forEach((method) => {
    const originalMethod = Array.prototype[method]
    arrayInstrumentations[method] = function (...args) {
        let res = originalMethod.apply(this, args)
        if (res === false || res === -1) {
            res = originalMethod.apply(this.raw, args)
        }
        return res
    }
})
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach((method) => {
    const originalMethod = Array.prototype[method]
    arrayInstrumentations[method] = function (...args) {
        shouldTrack = false
        let res = originalMethod.apply(this, args)
        shouldTrack = true
        return res
    }
})
function reactive(data, isShallow = false, isReadonly = false) {
    return new Proxy(data, {
        // 拦截读取操作
        get(target, key, receiver) {
            if (key === 'raw') {
                return target
            }
            if (
                Array.isArray(target) &&
                arrayInstrumentations.hasOwnProperty(key)
            ) {
                return Reflect.get(arrayInstrumentations, key, receiver)
            }
            if (!isReadonly && typeof key !== 'symbol') {
                track(target, key)
            }
            // 返回属性值
            const res = Reflect.get(target, key, receiver)
            if (isShallow) {
                return res
            }
            if (typeof res === 'object' && res !== null) {
                return reactive(res)
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
            track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
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

// const arr = reactive(['foo'])
// effect(() => {
//     for (const key in arr) {
//         console.log(key)
//     }
// })
// // arr[100] = 'bar'
// arr.length = 0

// const obj = {
//     val: 0,
//     [Symbol.iterator]() {
//         return {
//             next: () => {
//                 return {
//                     value: this.val++,
//                     done: this.val > 10,
//                 }
//             },
//         }
//     },
// }
//
// for (const value of obj) {
//     console.log(value)
// }

// const arr = reactive([1, 2, 3, 4, 5])
// arr[Symbol.iterator] = function () {
//     const target = this
//     const len = target.length
//     let index = 0
//     return {
//         next: () => {
//             return {
//                 value: index < len ? target[index] : undefined,
//                 done: index++ >= len,
//             }
//         },
//     }
// }
// const itr = arr[Symbol.iterator]()
// console.log(itr.next())

// effect(() => {
//     for (const value of arr) {
//         console.log(value)
//     }
// })
// arr[1] = 'bar'
// arr.length = 0

// ;(function () {
//     const obj = {}
//     const arr = reactive([obj])
//     console.log(arr.includes(obj))
// })()

;(function () {
    const arr = reactive([])
    // push方法读取length属性
    effect(() => {
        arr.push(1)
    }) //与length属性建立联系
    effect(() => {
        arr.push(1)
    })
})()
