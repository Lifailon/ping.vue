const express       = require('express')
const ping          = require('ping')
const bodyParser    = require('body-parser')
const { Date } = require('core-js')

const app = express()

// Middleware для JSON
app.use(bodyParser.json())

// CORS заголовки для работы frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    next()
})

// Хранилище для статистики пингов
const pingResults = {}

// Основная функция
async function pingHost(host) {
    try {
        const result = await ping.promise.probe(host)
        const currentTime = new Date().toISOString()
        // Если хранимые результаты существуют, обновляем их
        if (pingResults[host]) {
            pingResults[host].time = result.time // Обновляем время ответа
            // Если результат успешный, фиксируем текущее время, или возвращаем последнюю дату, когда был доступ
            pingResults[host].lastAvailable = result.alive ? currentTime : pingResults[host].lastAvailable
            pingResults[host].lastUnavailable = !result.alive ? currentTime : pingResults[host].lastUnavailable
            // Обновляем счетчики успешных и неуспешных пингов
            if (result.alive) {
                pingResults[host].successful++
            } else {
                pingResults[host].failed++
            }
        }
        // Добавляем в хранилище новый хост с начальными значениями
        else {
            pingResults[host] = {
                host: host,
                time: result.time,
                status: result.alive ? 'Alive' : 'Unreachable',
                lastAvailable: result.alive ? currentTime : null,
                lastUnavailable: result.alive ? null : currentTime,
                successful: result.alive ? 1 : 0,
                failed: result.alive ? 0 : 1,
            }
        }
        return pingResults[host]
    }
    catch (error) {
        return {
            host: host,
            time: null,
            status: 'Error',
            lastAvailable: null,
            lastUnavailable: new Date().toISOString(),
            successful: 0,
            failed: 1,
        }
    }
}

// Пинг одного адреса или всей подсети
app.post('/ping', async (req, res) => {
    const { addresses } = req.body
    const promises = []
    // Проверяем. что полученные данные в теле запроса не пустые или являются массивом
    if (!addresses || addresses.length === 0 || !Array.isArray(addresses)) {
        return res.status(400).json({ error: 'Address is required.' })
    }
    for (const address of addresses) {
        // Проверка на подсеть
        if (address.endsWith('.0')) {
            const subnet = address.split('.').slice(0, 3).join('.')
            for (let i = 1; i <= 254; i++) {
                const host = `${subnet}.${i}`
                promises.push(pingHost(host))
            }
        }
        // Если это один IP-адрес
        else {
            promises.push(pingHost(address))
        }
    }
    // Ожидание выполнения всех пингов
    const results = await Promise.all(promises)
    res.json(results)
})

// Конечная точка для очистки данных счетчиков
app.post('/reset', (req, res) => {
    const { addresses } = req.body
    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({ error: 'Addresses are required.' })
    }
    for (const address of addresses) {
        if (pingResults[address]) {
            delete pingResults[address]
            // pingResults[address].successful = 0
            // pingResults[address].failed = 0
        }
    }
    res.json({ message: 'Ping results have been reset.' })
})

// Запуск сервера
app.listen(3000, () => {
    console.log('The server is running on http://localhost:3000')
})