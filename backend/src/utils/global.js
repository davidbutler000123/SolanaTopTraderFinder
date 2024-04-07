
export const logWithTime = (log) => {
    const nowTime = new Date()
    console.log(`${nowTime.toLocaleDateString()} ${nowTime.toLocaleTimeString()} -> ${log}`)
}