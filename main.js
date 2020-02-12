import utils from './utils.js'
import throttle from './throttle.js'
import RenderObject from './interfaces/RenderObject.js'

function componentToHex(c) {
    let hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return `${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

function Color(r, g, b) {
    return {r, g, b}
}

function Point(x, y, z) {
    return {x, y, z}
}

//Really a global at this points, should be passed into constructor of class, where Shape is used.
let Shape;

function ShapeFactory(meshes) {
    return {
        Prism(point, width, depth, height) {
            const scale = 1
            return {
                draw(scene, color, id) {
                    if (meshes[id]) {
                        meshes[id].position.set(-(point.y + depth * .5) * scale, (point.z + height * .5) * scale, -(point.x + width * .5) * scale)
                    }
                    else {
                        let geometry = new THREE.BoxGeometry(depth * scale, height * scale, width * scale)
                        let material = new THREE.MeshPhongMaterial({color: parseInt(rgbToHex(color.r, color.g, color.b), 16)})
                        let mesh = new THREE.Mesh(geometry, material)
                        mesh.position.set(-(point.y + depth * .5) * scale, (point.z - height) * scale, -(point.x + width * .5) * scale)
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        meshes[id] = mesh
                        scene.add(mesh)
                    }
                }
            }
        },
        Pyramid(point, width, depth, height) {
            const scale = 10
            return {
                draw(scene, color, id) {
                    // let geometry = new THREE.BoxGeometry(width * scale, depth * scale, height * scale)
                    // let material = new THREE.MeshNormalMaterial()
                    // let mesh = new THREE.Mesh(geometry, material)
                    // scene.add(mesh)
                }
            }
        }
    }
}

function addAdapterFactory(scene, meshes, lights) {
    return () => {
        let activeIds = {}
        return {
            addAdapter: {
                add(shape, color, id) {
                    activeIds[id] = true
                    shape.draw(scene, color, id)
                },
                light(position, color, id, targetId) {
                    activeIds[id] = true
                    if (lights[id]) {
                        let light = lights[id]
                        light.position.x = -position.y
                        light.position.y = position.z + 2
                        light.position.z = -position.x
                        // light.position.set(1, 1, 15)
                        light.updateMatrix();
                        light.updateMatrixWorld();
                    }
                    else {
                        let light = new THREE.PointLight(parseInt(rgbToHex(color.r, color.g, color.b), 16), 1, 100);
                        lights[id] = light
                        // light.target = meshes[targetId]
                        light.position.set(position.y, position.z, position.x);
                        light.castShadow = true;
                        scene.add(light);
                    }
                }
            },
            clearUnusedMeshes() {
                for (let id of Object.keys(meshes)) {
                    if (!activeIds[id]) {
                        let mesh = meshes[id]
                        scene.remove(mesh)
                        delete meshes[id]
                    }
                }
            }
        }
    }
}

function contextAdapterFactory(container) {
    let components = {}
    let fillStyle = ''
    let font = ''
    
    return () => {
        let activeIds = {}
        return {
            contextAdapter: {
                fillRect(x, y, w, h, id) {
                    activeIds[id] = true
                    _fillRect(x, y, w, h, id)
                },
                fillText(text, x, y, maxWidth, id) {
                    activeIds[id] = true
                    _fillText(text, x, y, maxWidth, id)
                },
                set font(value) {
                    font = value
                },
                set fillStyle(value) {
                    fillStyle = value
                }
            },
            clearUnusedElements() {
                for (let id of Object.keys(components)) {
                    if (!activeIds[id]) {
                        let elements = components[id]
                        for (let element of elements) {
                            element.remove()
                            delete components[id]
                        }
                    }
                }
            }
        }
    }
    
    function _fillRect(x, y, w, h, id) {
        let elements = components[id]
        let element
        if (!elements) {
            element = document.createElement('div')
            components[id] = [element]
            container.appendChild(element)
        }
        if (!element) [element] = elements
        
        Object.assign(element.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: `${w}px`,
            height: `${h}px`,
            backgroundColor: fillStyle
        })
    }
    
    function _fillText(text, x, y, maxWidth, id) {
        let elements = components[id]
        if (!elements) {
            let textWrapper = document.createElement('div')
            let textContainer = document.createElement('div')
            elements = [textWrapper, textContainer]
            components[id] = elements
            textWrapper.appendChild(textContainer)
            container.appendChild(textWrapper)
        }
        let [textWrapper, textContainer] = elements
        
        Object.assign(textWrapper.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
        })
        Object.assign(textContainer.style, {
            display: 'inline-block',
            maxWidth: maxWidth,
            font: font,
            color: fillStyle
        })
        textContainer.textContent = text
    }
}

function PickUpObject({pickUp}) {
    return {
        pickUp(changeStat) {
            pickUp && pickUp(changeStat)
        }
    }
}

function CollidableObject({renderObject}) {
    return {
        ...renderObject,
        collidesWith(targetPosition) {
            let sourcePosition = renderObject.getPosition()
            return utils.isPointIn(targetPosition.x, targetPosition.y, sourcePosition.x, sourcePosition.y, 1, 1)
        }
    }
}

function BuildingObject({progress}) {
    return {
        progress(...args) {
            progress && progress(...args)
        }
    }
}

function ThreeJSController() {
    
    let renderer;
    let scene;
    let camera;
    let controls;
    
    return {
        init,
        render,
        getScene() {
            return scene
        },
        moveCamera(dx, dy) {
            let oldPosition = camera.position
            camera.position.set(oldPosition.x - dy, oldPosition.y + dx, oldPosition.z)
        }
    }
    
    function init() {
        renderer = createRenderer()
        document.body.appendChild(renderer.domElement);
        camera = createCamera()
        controls = createControls(renderer, camera)
        
        scene = new THREE.Scene();
    }
    
    function createRenderer() {
        let renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        return renderer
    }
    
    function createCamera() {
        // camera
        let aspect = window.innerWidth / window.innerHeight;
        let d = 20;
        let camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        
        // // method 1 - use lookAt
        // camera.position.set( 20, 20, 20 );
        // camera.lookAt( scene.position );
        
        // method 2 - set the x-component of rotation
        camera.position.set(20, 20, 20);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = -Math.PI / 4;
        camera.rotation.x = Math.atan(-1 / Math.sqrt(2));
        
        return camera
    }
    
    function createControls(renderer, camera) {
        let controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.addEventListener('change', render);
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.maxPolarAngle = Math.PI / 2;
        return controls
    }
    
    function render() {
        renderer.render(scene, camera);
    }
}

function Screen() {
    let width = 1000
    let height = 1000
    
    let oldFocus = {x: 0, y: 0}
    
    let meshes = {}
    let lights = {}
    Shape = ShapeFactory(meshes)
    let threeJSC = ThreeJSController()
    threeJSC.init()
    
    let renderObjects = []
    let sortedRenderObjects = {}
    
    const createContextAdapter = contextAdapterFactory(document.body)
    const createAddAdapter = addAdapterFactory(threeJSC.getScene(), meshes, lights)
    
    return {
        addRenderObject(renderObject, sortOrder) {
            if (typeof sortOrder === 'number') {
                sortedRenderObjects[sortOrder] = sortedRenderObjects[sortOrder] || []
                sortedRenderObjects[sortOrder].push(renderObject)
            }
            else {
                renderObjects.push(renderObject)
            }
        },
        render() {
            let {contextAdapter, clearUnusedElements} = createContextAdapter()
            let {addAdapter, clearUnusedMeshes} = createAddAdapter()
            
            let keys = Object.keys(sortedRenderObjects)
            keys.sort((a, b) => a - b)
            for (let layerSortOrder of keys) {
                sortedRenderObjects[layerSortOrder] = sortedRenderObjects[layerSortOrder]
                    .filter(obj => !obj.shouldDispose())
                
                let layer = sortedRenderObjects[layerSortOrder]
                for (let renderObject of layer) {
                    renderObject.render(contextAdapter, addAdapter)
                }
            }
            
            renderObjects = renderObjects.filter(obj => !obj.shouldDispose())
            for (let renderObject of renderObjects) {
                renderObject.render(contextAdapter, addAdapter)
            }
            
            clearUnusedMeshes()
            clearUnusedElements()
            threeJSC.render()
        },
        getDimensions() {
            return {width, height}
        },
        setFocus(x, y) {
            threeJSC.moveCamera(x - oldFocus.x, y - oldFocus.y)
            oldFocus = {x, y}
        },
        _debug(blocks) {
            blocks.forEach(w => {
                let {x, y} = w.getPosition()
                let p = new Point(x, y, 0)
                let np = iso._translatePoint(p)
                console.log(np)
            })
        }
    }
}

function Tile({x, y, tileSize}) {
    return {
        isPointInTile(pointX, pointY) {
            return pointX > x && pointX < x + tileSize
                && pointY > y && pointY < y + tileSize
        },
        getPosition: () => ({x, y}),
        getDimensions: () => ({width: tileSize, height: tileSize})
    }
}

function Map({width, height}) {
    const color = new Color(235, 208, 143)
    let tiles = []
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            tiles.push(Tile({x, y, tileSize: 1}))
        }
    }
    
    let id = guid()
    return {
        ...RenderObject({
            render(context, iso) {
                iso.add(Shape.Prism(new Point(0, 0, 0), width, height, 1), color, id);
            },
            getPosition() {
                return {x: 0, y: 0, z: 0}
            }
        }),
        getTilesOnPoint(pointX, pointY) {
            let hits = []
            for (let tile of tiles) {
                if (tile.isPointInTile(pointX, pointY)) {
                    hits.push(tile)
                }
            }
            return hits
        },
        getMeshIds() {
            return [id]
        }
    }
}

function ContextMenu({player, map, actionMap}) {
    let closed = true
    let itemNames = Object.keys(actionMap)
    let position = {
        x: 0,
        y: 0
    }
    
    let items = []
    let selectedItemIndex = -1
    let itemY = 0
    const itemHeight = 60
    const itemWidth = 210
    for (let itemName of itemNames) {
        items.push(ContextMenuItem({
            itemName,
            x: 0,
            y: itemY,
            width: itemWidth,
            height: itemHeight,
            action: actionMap[itemName]
        }))
        itemY += itemHeight
    }
    
    const id = guid()
    const TOGGLE_KEY = 'Enter'
    const EXIT_MENU = 'Escape'
    window.addEventListener('keydown', (e) => {
        if (closed && e.key !== TOGGLE_KEY) {
            return
        }
        if (closed && e.key === TOGGLE_KEY) {
            closed = false
            return
        }
        
        switch (e.key) {
            case EXIT_MENU:
                console.log('exit')
                selectedItemIndex = -1
                closed = true
                break
            case "ArrowDown":
                selectedItemIndex++
                break
            case "ArrowUp":
                selectedItemIndex--
                break
            case TOGGLE_KEY:
                let selectedItem = items[selectedItemIndex]
                if (selectedItem) {
                    selectedItem.clicked(player.getPosition())
                }
                selectedItemIndex = -1
                closed = true
                break
        }
    })
    
    return RenderObject({
        render(context) {
            if (closed) return
            
            context.fillStyle = '#D6D6D6'
            context.fillRect(position.x, position.y, 210, 180, id)
            items.forEach((item, index) => {
                if (index === selectedItemIndex) {
                    item.select()
                }
                else {
                    item.deselect()
                }
                item.render(context)
            })
        }
    })
}

function ContextMenuItem({itemName, x, y, width, height, action}) {
    const fontSize = 30
    const textPosY = y + fontSize * .33
    const textPosX = x + 10
    let offsetX = 0
    let offsetY = 0
    let selected = false
    let id = guid()
    return {
        ...RenderObject({
            render(context) {
                if (selected) {
                    context.fillStyle = '#cc3'
                }
                else {
                    context.fillStyle = '#333'
                }
                context.fillRect(x + offsetX, y + offsetY, width, height, `${id}:0`)
                context.fillStyle = '#fff'
                context.font = `${fontSize}px Helvetica`
                context.fillText(itemName, textPosX + offsetX, textPosY + offsetY, `${width - 10}px`, `${id}:1`)
            }
        }),
        clicked(...args) {
            action(...args)
        },
        isPointInItem(pointX, pointY) {
            return utils.isPointIn(pointX, pointY, x + offsetX, y + offsetY, width, height)
        },
        setOffset(_offsetX, _offsetY) {
            offsetX = _offsetX
            offsetY = _offsetY
        },
        select() {
            selected = true
        },
        deselect() {
            selected = false
        }
    }
}

function House({x, y, z}, {allHouses = []} = {}) {
    let baseId = guid()
    let roofId = guid()
    
    return {
        ...CollidableObject({
            renderObject: RenderObject({
                render(context, iso) {
                    let baseOffset = 1 + allHouses.length * .25
                    iso.add(Shape.Prism(Point(x, y, z), baseOffset, baseOffset, baseOffset), new Color(205, 154, 42), `${baseId}:0`)
                    iso.add(Shape.Pyramid(Point(x, y, z + baseOffset), baseOffset, baseOffset, 1), new Color(225, 174, 62), `${baseId}:1`)
                },
                getPosition() {
                    return {x, y, z}
                },
                getMeshIds() {
                    return [`${baseId}:0`, `${baseId}:1`]
                }
            })
        }),
        ...BuildingObject({
            progress(delta, deps) {
                deps.player && deps.player.changeStat('credits', credits => credits + delta)
            }
        })
    }
}

function Farm({position}) {
    let id = guid()
    return {
        ...RenderObject({
            render(context, iso) {
                iso.add(Shape.Prism(Point(position.x, position.y, position.z), .22, 1, 0.05), new Color(205, 205, 10), `${id}:0`)
                iso.add(Shape.Prism(Point(position.x + .25, position.y, position.z), .22, 1, 0.05), new Color(205, 205, 10), `${id}:1`)
                iso.add(Shape.Prism(Point(position.x + .5, position.y, position.z), .22, 1, 0.05), new Color(205, 205, 10), `${id}:2`)
                iso.add(Shape.Prism(Point(position.x + .75, position.y, position.z), .22, 1, 0.05), new Color(205, 205, 10), `${id}:3`)
            },
            getPosition() {
                return {...position}
            },
            getMeshIds() {
                return [`${id}:0`, `${id}:1`, `${id}:2`, `${id}:3`]
            }
        }),
        ...BuildingObject({
            progress(delta, deps) {
                deps.player && deps.player.changeStat('food', food => food + delta)
            }
        })
    }
}

function Mountain({x, y, z}) {
    let mt1 = guid()
    let mt2 = guid()
    let mt3 = guid()
    return RenderObject({
        render(context, iso) {
            iso.add(Shape.Pyramid(Point(x + 4.5, y + 2.6, z), 4, 4, 2.8), new Color(165, 165, 165), mt1)
            iso.add(Shape.Pyramid(Point(x + .5, y + .5, z), 6, 6, 5), new Color(125, 125, 125), mt1)
            iso.add(Shape.Pyramid(Point(x - .5, y, z), 4, 4, 2.8), new Color(95, 95, 95), mt1)
        },
        getPosition() {
            return {x, y, z}
        }
    })
}

function CollisionDetectionModule(buildingRepository, player) {
    return {
        willCollide(nextPosition) {
            for (let building of buildingRepository.get()) {
                if (building.collidesWith) {
                    if (building.collidesWith(nextPosition)) {
                        return true
                    }
                }
            }
            return false
        },
        willCollideWithPlayer(sourcePosition) {
            if (!player) return false
            
            if (player.collidesWith) {
                if (player.collidesWith(sourcePosition)) {
                    return true
                }
            }
            else {
                let playerPosition = player.getPosition()
                if (utils.isPointIn(sourcePosition.x, sourcePosition.y, playerPosition.x, playerPosition.y, 1, 1)) {
                    return true
                }
            }
            return false
        }
    }
}

function Player({position, startStats, collisionDetectionModule}) {
    let {x, y, z} = position
    let px = x
    let py = y
    let pz = z
    let pdx = 1
    let pdy = 1
    let pdz = 0
    
    let stats = {
        credits: 100,
        ...startStats
    }
    
    const animationLength = 120
    let animation = {
        running: false,
        elapsedTime: 0,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    }
    
    let id = guid()
    
    const move = (diffX, diffY) => {
        let endPosition = {x: px + diffX, y: py + diffY}
        if (collisionDetectionModule && collisionDetectionModule.willCollide(endPosition)) return;
        
        animate({x: px, y: py}, endPosition)
    }
    const animate = (startPos, endPos) => {
        if (animation.running) {
            return
        }
        animation.running = true
        animation.elapsedTime = 0
        animation.startX = startPos.x
        animation.startY = startPos.y
        animation.endX = endPos.x
        animation.endY = endPos.y
    };
    
    return {
        ...RenderObject({
            render(context, iso, render) {
                //Platform figure
                iso.add(Shape.Prism(Point(px, py, pz), pdx, pdy, .1), new Color(100, 100, 255), id)
                
                
                //Stick figure
                // iso.add(Shape.Prism(Point(px, py, pz), .5, .5, .6), new Color(90, 90, 200), `${id}:0`)
                // iso.add(Shape.Prism(Point(px, py, pz + .6), .5, .5, .5), new Color(90, 200, 90), `${id}:1`)
                // iso.add(Shape.Prism(Point(px, py, pz + 1.1), .5, .5, .36), new Color(213, 166, 129), `${id}:2`)
                // iso.add(Shape.Prism(Point(px, py, pz + 1.46), .5, .5, .1), new Color(60, 30, 20), `${id}:3`)
                
                //Moving light source
                iso.light(Point(px, py, pz), new Color(100, 100, 255), `${id}:4`, `${id}:0`)
            },
            getPosition() {
                return {px, py, pz}
            },
            getMeshIds() {
                return [`${id}:0`, `${id}:1`, `${id}:2`, `${id}:3`]
            }
        }),
        moveUp() {
            move(1, 0)
        },
        moveDown() {
            move(-1, 0)
        },
        moveLeft() {
            move(0, 1)
        },
        moveRight() {
            move(0, -1)
        },
        getPosition() {
            return {x: px, y: py, z: pz}
        },
        getStats() {
            return {...stats}
        },
        changeStat(statName, modifier) {
            stats[statName] = modifier(stats[statName] || 0)
        },
        progress(delta) {
            if (animation.running) {
                let progress = animation.elapsedTime / animationLength
                if (progress >= 1) {
                    animation.running = false
                    px = Math.round(px)
                    py = Math.round(py)
                }
                else {
                    px = animation.startX + progress * (animation.endX - animation.startX)
                    py = animation.startY + progress * (animation.endY - animation.startY)
                    animation.elapsedTime += delta * 1000
                }
            }
        },
        isPlayer: true
    }
}

function PlayerStatusDisplay({player}) {
    const fontSize = 56
    const posY = fontSize * 2
    const id = guid()
    return RenderObject({
        render(context) {
            context.fillStyle = 'white'
            context.font = `${fontSize}px Helvetica`
            let playerStats = player.getStats()
            let playerStatsText = Object.keys(playerStats)
                .map(key => {
                    return `${key}: ${typeof playerStats[key] === 'number' ? Math.round(playerStats[key]) : playerStats[key]}`
                }).join('\t')
            context.fillText(playerStatsText, 50, posY, 'auto', id)
        }
    })
}

function WoodBlock({position}) {
    let {x, y, z = 1} = position
    let shouldDispose = false
    
    let id = guid()
    return {
        ...CollidableObject({
            renderObject: RenderObject({
                render(context, iso) {
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z), .92, .92, 1), new Color(90, 146, 120), id)
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z + 1), .92, .92, 1), new Color(90, 146, 120), `${id}:1`)
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z + 2), .92, .92, 1), new Color(90, 146, 120), `${id}:2`)
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z + 3), .92, .92, 1), new Color(90, 146, 120), `${id}:3`)
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z + 4), .92, .92, 1), new Color(90, 146, 120), `${id}:4`)
                    iso.add(Shape.Prism(Point(x + .02, y + .02, z + 5), .92, .92, 1), new Color(90, 146, 120), `${id}:5`)
                },
                getPosition() {
                    return {...position}
                },
                shouldDispose() {
                    return shouldDispose
                },
                getMeshIds() {
                    return [id]
                }
            })
        }),
        ...BuildingObject({}),
        ...PickUpObject({
            pickUp(changeStat) {
                changeStat('wood', wood => wood + 100)
                shouldDispose = true
            }
        })
    }
}

function PickUpManager({pickUpItems, player}) {
    const PICK_UP_RANGE = 1
    window.addEventListener('keydown', e => {
        switch (e.key) {
            case " ": {
                let {x: px, y: py} = player.getPosition()
                let itemInPosition = pickUpItems.find(i => {
                    let {x, y} = i.getPosition()
                    
                    return utils.isPointIn(px, py, x - PICK_UP_RANGE, y - PICK_UP_RANGE, PICK_UP_RANGE * 2 + 1, PICK_UP_RANGE * 2 + 1)
                })
                
                if (itemInPosition) {
                    itemInPosition.pickUp(player.changeStat)
                }
                break
            }
        }
    })
    
    return RenderObject({
        render() {
            pickUpItems = pickUpItems.filter(i => !i.shouldDispose())
        }
    })
}

function World({buildingRepository, player, enemies = []}) {
    let enemyController = EnemyController({enemies, player})
    return {
        progress(delta) {
            buildingRepository.set(buildingRepository.get().filter(b => !b.shouldDispose()))
            
            let buildingDeps = {player, enemies}
            for (let building of buildingRepository.get()) {
                building.progress(delta, buildingDeps)
            }
            player.progress(delta)
            enemyController.progress(delta)
        }
    }
}

function Enemy({position, collisionDetectionModule, log, gameManager}) {
    let internalPlayer = Player({position, collisionDetectionModule})
    let id = guid()
    return {
        ...internalPlayer,
        ...RenderObject({
            render(context, iso) {
                internalPlayer.render(context, iso)
            },
            getPosition() {
                return internalPlayer.getPosition()
            }
        }),
        progress(delta) {
            if (collisionDetectionModule && collisionDetectionModule.willCollideWithPlayer(internalPlayer.getPosition())) {
                log.log('YOU DIED!')
                gameManager.end()
            }
            internalPlayer.progress(delta)
        }
    }
}

function EnemyController({enemies, player}) {
    const RANGE = 7
    let enemyMoves = enemies.map(e => {
        return {
            up: throttle(e.moveUp, 1000),
            down: throttle(e.moveDown, 1000),
            left: throttle(e.moveLeft, 1000),
            right: throttle(e.moveRight, 1000)
        }
    })
    
    return {
        progress(delta) {
            let {x: px, y: py} = player.getPosition()
            let index = 0
            for (let enemy of enemies) {
                let {x: ex, y: ey} = enemy.getPosition()
                if (utils.getDistance(ex, ey, px, py) <= RANGE) {
                    let dx = px - ex;
                    let dy = py - ey;
                    let angle = Math.atan2(dy, dx)
                    let xVelocity = Math.cos(angle);
                    let yVelocity = Math.sin(angle);
                    if (Math.abs(xVelocity) > Math.abs(yVelocity)) {
                        if (xVelocity > 0) {
                            enemyMoves[index].up()
                        }
                        else {
                            enemyMoves[index].down()
                        }
                    }
                    else {
                        if (yVelocity > 0) {
                            enemyMoves[index].left()
                        }
                        else {
                            enemyMoves[index].right()
                        }
                    }
                    
                    enemy.progress(delta)
                }
                
                index++
            }
        }
    }
}

function Log() {
    let newLogs = []
    const timeout = 5000
    const id = guid()
    
    let fontSize = 48
    let yOffset = fontSize * 2 + 300
    return {
        ...RenderObject({
            render(context) {
                context.fillStyle = 'white'
                context.font = `${fontSize}px Helvetica`;
                
                let yPos = yOffset;
                [...newLogs].forEach((logMessage, index) => {
                    context.fillText(logMessage, 50, yPos + fontSize * 1.5 * (index + 1), 'auto', `${id}:${index}`)
                })
            }
        }),
        log(message) {
            newLogs.push(message)
            setTimeout(() => {
                newLogs.shift()
            }, timeout)
        }
    }
}

function BuildingFactory() {
    return {
        woodBlocks(mapWidth, mapHeight) {
            let blocks = []
            for (let i = 0; i < 50; i++) {
                let x = Math.round(Math.random() * mapWidth)
                let y = Math.round(Math.random() * mapHeight)
                blocks.push(WoodBlock({position: {x, y}}))
            }
            return blocks
        }
    }
}

function BuildingRepository(initialBuildings) {
    let buildings = [...initialBuildings]
    return {
        get() {
            return buildings
        },
        set(newBuildings) {
            buildings = newBuildings
        },
        add(building) {
            buildings.push(building)
        }
    }
}

function GameManager() {
    let hasEnded = false
    return {
        end() {
            hasEnded = true
        },
        hasEnded: () => hasEnded
    }
}


(function () {
    // let canvas = document.getElementById('screen')
    let screen = Screen()
    screen.getDimensions()
    const mapWidth = 200
    const mapHeight = 200
    
    let gameManager = GameManager()
    let log = Log()
    let buildingFactory = BuildingFactory()
    let woodBlocks = buildingFactory.woodBlocks(mapWidth, mapHeight)
    let buildings = [...woodBlocks]
    let buildingRepository = BuildingRepository(buildings)
    let player = Player({
        position: {x: 1, y: 1, z: 1},
        startStats: {
            credits: 50,
            wood: 105
        },
        collisionDetectionModule: CollisionDetectionModule(buildingRepository)
    })
    let enemyCollisionDetectionModule = CollisionDetectionModule(buildingRepository, player)
    let enemies = [
        Enemy({
            position: {x: 5, y: 15, z: 1},
            player,
            log,
            gameManager,
            collisionDetectionModule: enemyCollisionDetectionModule
        }),
        Enemy({
            position: {x: 1, y: 13, z: 1},
            player,
            log,
            gameManager,
            collisionDetectionModule: enemyCollisionDetectionModule
        }),
        Enemy({
            position: {x: 5, y: 19, z: 1},
            player,
            log,
            gameManager,
            collisionDetectionModule: enemyCollisionDetectionModule
        })
    ]
    let pickUpManager = PickUpManager({pickUpItems: [...woodBlocks], player})
    let playerStatus = PlayerStatusDisplay({player})
    let farm = Farm({position: {x: 10, y: 10, z: 1}})
    buildingRepository.add(farm)
    let world = World({buildingRepository, player, enemies})
    let map = Map({width: mapWidth, height: mapHeight})
    
    const costLookUp = {
        'House': {wood: 100},
        'Farm': {wood: 150}
    }
    const chargePlayer = (player, type, canAffordAction) => {
        let costByMaterial = costLookUp[type]
        for (let material of Object.keys(costByMaterial)) {
            if ((player.getStats()[material] || 0) < costByMaterial[material]) {
                log.log(`Cannot afford ${type}`)
                return
            }
        }
        
        let materials = costLookUp[type]
        for (let material of Object.keys(materials)) {
            player.changeStat(material, m => m - materials[material])
        }
        canAffordAction()
    }
    
    let actionMap = {
        'House'(position) {
            chargePlayer(player, 'House', () => {
                let house = House(position)
                screen.addRenderObject(house, 3)
                buildingRepository.add(house)
            })
        },
        'Farm'(position) {
            chargePlayer(player, 'Farm', () => {
                let farm = Farm({position})
                screen.addRenderObject(farm, 2)
                buildingRepository.add(farm)
            })
        }
    }
    let contextMenu = ContextMenu({player, map, actionMap})
    screen.addRenderObject(log)
    screen.addRenderObject(contextMenu)
    screen.addRenderObject(playerStatus)
    screen.addRenderObject(map, 0)
    woodBlocks.forEach(b => {
        screen.addRenderObject(b, 3)
    })
    enemies.forEach(e => {
        screen.addRenderObject(e, 3)
    })
    screen.addRenderObject(player, 3)
    screen.addRenderObject(pickUpManager)
    screen.addRenderObject(farm, 2)
    const handlePlayerKeyEvent = key => {
        if (key === 'w') {
            console.log('moveUp')
            player.moveUp();
        }
        else if (key === 'a') {
            player.moveLeft();
        }
        else if (key === 's') {
            player.moveDown();
        }
        else if (key === 'd') {
            player.moveRight();
        }
        
    };
    window.addEventListener('keydown', e => {
        if (e.key === 'm') {
            screen._debug([...woodBlocks])
        }
        handlePlayerKeyEvent(e.key)
    })
    
    let screenPosX = 10
    let screenPosY = 10
    
    let {x: playerPosX, y: playerPosY} = player.getPosition()
    let {x: goalPlayerPosX, y: goalPlayerPosY} = player.getPosition()
    screen.setFocus(playerPosX, playerPosY)
    let animationStart = false
    const motionTriggerDistance = 10
    let previousLoopTime = 0
    
    let animation = Animation(600, progress => {
        if (progress >= 1) {
            screen.setFocus(goalPlayerPosX, goalPlayerPosY)
            playerPosX = goalPlayerPosX
            playerPosY = goalPlayerPosY
            animation.reset()
            animationStart = false
        }
        else {
            let diffX = goalPlayerPosX - playerPosX
            let diffY = goalPlayerPosY - playerPosY
            screen.setFocus(playerPosX + diffX * progress, playerPosY + diffY * progress)
        }
    })
    let animationDelay = AnimationDelay(200)
    let loop = (time) => {
        if (gameManager.hasEnded()) return
        
        let delta = (time - previousLoopTime) * .001
        
        screenPosX += .05 * delta
        screenPosY += .05 * delta
        
        let {x: newPlayerPosX, y: newPlayerPosY} = player.getPosition()
        let positionChanged = (newPlayerPosX !== playerPosX || newPlayerPosY !== playerPosY)
        if (positionChanged && !animationDelay.isDone() && !animationDelay.isQueued()) {
            let playerMovedBeyondTriggerDistance = newPlayerPosX - playerPosX > motionTriggerDistance
                || newPlayerPosX - playerPosX < -motionTriggerDistance
                || newPlayerPosY - playerPosY > motionTriggerDistance
                || newPlayerPosY - playerPosY < -motionTriggerDistance
            if (playerMovedBeyondTriggerDistance) {
                animationDelay.queue()
            }
        }
        if (animationDelay.isDone()) {
            let currentPosition = player.getPosition()
            goalPlayerPosX = currentPosition.x
            goalPlayerPosY = currentPosition.y
            animationStart = true
            animationDelay.reset()
        }
        if (animationStart) {
            animation.animate(delta)
        }
        
        previousLoopTime = time
        world.progress(delta)
        screen.render()
        setBackground(colorOfDay(time))
        animationDelay.progress(delta)
        requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
})()

function AnimationDelay(delayTime) {
    let elapsedTimeMilliseconds = 0
    let done = false
    let queued = false
    return {
        isDone: () => done,
        isQueued: () => queued,
        progress(deltaSeconds) {
            if (!queued) return
            
            elapsedTimeMilliseconds += deltaSeconds * 1000
            if (elapsedTimeMilliseconds >= delayTime) {
                done = true
                queued = false
            }
        },
        reset() {
            done = false
            queued = false
        },
        queue() {
            queued = true
        }
    }
}

function Animation(animationTime, drawFrame) {
    let elapsedTimeMilliseconds = 0
    return {
        animate(deltaSeconds) {
            elapsedTimeMilliseconds += deltaSeconds * 1000
            let progress = elapsedTimeMilliseconds / animationTime
            drawFrame(progress)
        },
        reset() {
            elapsedTimeMilliseconds = 0
        }
    }
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}


const dayMilliseconds = 100000

function colorOfDay(totalTimePassed) {
    let timeOfDay = totalTimePassed % (dayMilliseconds)
    
    // return 'linear-gradient(to top, #f3904f, #3b4371)'
    if (timeOfDay < dayMilliseconds * .3) {
        return 'rgb(0, 0, 47)'
    }
    else if (timeOfDay < dayMilliseconds * .6) {
        return 'rgb(135, 206, 235)'
    }
    else {
        return 'rgb(155, 50, 0)'
        // return 'rgb(255,140,0)'
    }
    
    let rgbValue = Math.round((timeOfDay / dayMilliseconds) * 255)
    return `rgb(${rgbValue},${rgbValue},${rgbValue})`
}

function setBackground(rgbTextValue) {
    // if (document.body.style.background === rgbTextValue) return
    // document.body.style.background = rgbTextValue
}

//// NEW NOTES

// Have camera follow player


//// OLD NOTES
// Get wood
// $$$ Render green wood blocks
// $$$ Go onto wood block and press SPACE to gain wood
// $$$ Randomly place wood on world inception
// $$$ Gather wood when next to wood and press SPACE (should take closest wood in +X direction)

// World
// $$$ Go to edge of map to scroll map
// Have areas (biomes) i.e. Forrest, Swamp, Ocean
// Have mountains that you cannot go over but around (fix rendering sorting quirk)

// Ambient
// $$$ Have background reflect time of day (color of sun/sky?)

// Rendering
// $$$ Render lower over higher items (seems very hard...)
// $$$ Fix quirks (sometimes it renders blocks vs players in wrong order)

//Player
// $$$ Animate motion
// $$$ Collision detection with wood blocks
// $$$ Fix quirks with collision detection (if click quickly can sometimes go through some walls). May have to do with queued walking animation.

//Byggnader
// $$$ Farm - gives food every round
// Butik - click space close to it to open shop?
// Skola

// Enemies
// $$$ Have enemy blocks that moves towards you
// $$$ Have enemy kill player on collision
// $$$ Have enemy not be able to go through objects
/// Fix quirks where enemy can go into objects, but not through them. Should stop earlier.
// Have enemies find ways around objects (hard)
// $$$ Have enemies only attack player in range

// $$$ Show capital/credits/money in view
// $$$ Increase money per house per loop by some amount
// $$$ Navigate up and down in context menu
// $$$ Click space to close context menu
// $$$ print tiled map
// $$$ click tile to open context menu
// $$$ click item in context menu to place it on tile