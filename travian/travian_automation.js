// ==UserScript==
// @name         Travian automation
// @namespace    danielv
// @version      1.1
// @description  Pls no tell admins
// @author       You
// @match        https://ts4.x1.international.travian.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=travian.com
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';
    await sleep(2)
    if (document.location.pathname == "/") {
        // We are on the login page
        let username = document.querySelector("div.innerLoginBox > form > table > tbody > tr.account > td:nth-child(2) > input")
        let password = document.querySelector("div.innerLoginBox > form > table > tbody > tr.pass > td:nth-child(2) > input")
        let loginButton = document.querySelector("#s1")

        let usernameValue = localStorage.getItem("username")
        let passwordValue = localStorage.getItem("password")

        if (usernameValue !== null && passwordValue !== null) {
            username.value = usernameValue
            password.value = passwordValue
            loginButton.click()
        } else {
            console.log("No username and password found")
            console.log("Please set them in localStorage.username and localStorage.password")
        }
    } else {
        try {
            periodicScrapes()
            await sleep(1)
            manager()
        } catch (e) {
            console.error(e)
            localStorage.error = e.toString()
        }
        setInterval(periodicScrapes, 3000)
        setInterval(manager, 60 * 1000)
        setTimeout(refresh, 60 * 60 * 1000)
    }
})();

function periodicScrapes() {
    scrapeResources()
    scrapeBuildList()
    scrapeBuildings()
}

function refresh() {
    console.log("Refreshing")
    document.location.reload()
}

function fullScrape() {
    // Shouldn't be triggered often. Navigate through the interface to scrape information

}

function manager() {
    if (!localStorage.error) {
        constructionManager()
    }
}

async function sleep(s) {
    return new Promise(r => setTimeout(r, s * 1000))
}

function constructionManager() {
    // Decide if its time to build something
    let buildList = getState("buildList")
    if (buildList.length == 0) {
        // Nothing is being constructed
        // Prioritize resources
        let resources = getState("resources")
        // Find the resource we have the least of
        let production = getResources().production.sort((a, b) => a.amount - b.amount)
        console.log(production)
        // Find lowest levelled resource of that type
        resources = resources.sort((a, b) => {
            // Sort by type priority
            if (a.type == b.type) {
                return a.level - b.level
            }
            let priority_A = production.findIndex(x => x.name === a.type)
            let priority_B = production.findIndex(x => x.name === b.type)
            return priority_A - priority_B
        })
        console.log(resources)
        resources = resources
            .filter(resource => resource.ready_to_upgrade)
            .filter(resource => resource.upgrading === false)
        // Upgrade the first item in the list
        if (resources.length > 0) {
            upgradeResource(resources[0])
            return
        }
    }
}
function upgradeResource(resource) {
    setState("upgradeResource", resource)
    // Navigate to resources page
    let context = getContext()
    if (!["resources", "build"].includes(context)) {
        console.log("Navigating to resource page")
        retrieveContext("resources")
        return
    }
    // Navigate to build page
    if (context !== "build") {
        console.log("Opening build page")
        let resources = Array.from(document.querySelectorAll("#resourceFieldContainer > .level.colorLayer"))
        let button = resources.find(x => x.href.split("=")[1].includes(resource.id))
        button.click()
        return
    }
    // Start upgrade
    let upgradeButton = document.querySelector(".textButtonV1.green.build")
    if (upgradeButton && !upgradeButton.classList.contains("disabled")) {
        console.log("Performing upgrade")
        upgradeButton.click()
    } else {
        console.log("ERROR performing upgrade failed")
        // Go into error state
        localStorage.error = true
    }
}
function getResources() {
    return {
        production: [{
            name: "lumber",
            amount: window.resources.production.l1
        }, {
            name: "clay",
            amount: window.resources.production.l2
        }, {
            name: "iron",
            amount: window.resources.production.l3
        }, {
            name: "wheat",
            amount: window.resources.production.l4 * 2
        }],
        storage: [{
            name: "lumber",
            amount: window.resources.storage.l1
        }, {
            name: "clay",
            amount: window.resources.storage.l2
        }, {
            name: "iron",
            amount: window.resources.storage.l3
        }, {
            name: "wheat",
            amount: window.resources.storage.l4
        },]
    }
}
function getState(state) {
    let data = localStorage.getItem(state)
    if (data !== null) {
        return JSON.parse(data)
    } else {
        return {}
    }
}
function setState(state, data) {
    localStorage.setItem(state, JSON.stringify(data))
}
function getContext() {
    // Check where we are in the interface
    if (document.querySelector(".village1")) return "resources"
    if (document.querySelector(".village2")) return "buildings"
    if (document.querySelector(".map2")) return "map"
    if (document.querySelector("#build")) return "build"
}
function retrieveContext(context, data) {
    let currentContext = getContext()
    if (currentContext === context) return data

    setState("retrieveContext", data)

    // Navitage to context
    if (context === "resources") {
        document.querySelector(".village.resourceView").click()
    }
    if (context === "buildings") {
        document.querySelector(".village.buildingView").click()
    }
    if (context === "map") {
        document.querySelector(".map").click()
    }
    if (context === "statistics") {
        document.querySelector(".statistics").click()
    }
    if (context === "reports") {
        document.querySelector(".reports").click()
    }
    if (context === "messages") {
        document.querySelector(".messages").click()
    }
    if (context === "dailyQuests") {
        document.querySelector(".dailyQuests").click()
    }
}
function scrapeResources() {
    let context = getContext()
    if (context !== "resources") return false
    // Gather data about the resource view
    let resources = Array.from(document.querySelectorAll("#resourceFieldContainer > .level.colorLayer"))
    let data = resources.map(resource => {
        let type
        if (resource.classList.contains("gid1")) type = "lumber"
        if (resource.classList.contains("gid2")) type = "clay"
        if (resource.classList.contains("gid3")) type = "iron"
        if (resource.classList.contains("gid4")) type = "wheat"
        return {
            level: resource.querySelector(".labelLayer").innerHTML || 0, // "" == 0, "1","2" etc
            ready_to_upgrade: resource.classList.contains("good"),
            not_ready_to_upgrade: resource.classList.contains("notNow"),
            upgrading: resource.classList.contains("underConstruction"),
            id: resource.href.split("=")[1],
            type,
        }
    })
    setState("resources", data)
}
function scrapeBuildList() {
    let context = getContext()
    if (!["resources", "buildings"].includes(context)) return false
    // Gather information about ongoing construction
    let data = Array.from(document.querySelectorAll(".buildingList > ul > li")).map(x => {
        return {
            done: x.querySelector(".buildDuration").innerHTML.split("done at ")[1].split("\t").join(""),
            name: x.querySelector(".name").innerText.split(" ")[0],
            level: x.querySelector(".name > span").innerHTML,
        }
    })
    setState("buildList", data)
}
function scrapeBuildings() {
    let context = getContext()
    if (context !== "buildings") return false
    let slots = Array.from(document.querySelectorAll(".buildingSlot"))
    let data = slots.map(slot => {
        return {
            name: slot.dataset.name,
            building_id: slot.dataset.buildingId,
            gid: slot.dataset.gid,
            aid: slot.dataset.aid,
        }
    })
    setState("buildings", data)
}
