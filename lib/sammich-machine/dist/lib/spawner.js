export var SpawnerFrameSpawnMethod;
(function (SpawnerFrameSpawnMethod) {
    SpawnerFrameSpawnMethod[SpawnerFrameSpawnMethod["SAME"] = 0] = "SAME";
    SpawnerFrameSpawnMethod[SpawnerFrameSpawnMethod["RANDOM"] = 1] = "RANDOM";
    SpawnerFrameSpawnMethod[SpawnerFrameSpawnMethod["SEQUENTIAL"] = 2] = "SEQUENTIAL";
})(SpawnerFrameSpawnMethod || (SpawnerFrameSpawnMethod = {}));
export const createSpawner = (spriteEntityFactory, _options, game) => {
    console.log("createSpawner", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
    const [SCREEN_W, SCREEN_H] = game.runtime.getScreen().getSize();
    const state = {
        count: 0,
        totalDt: 0,
        dt: 0,
        startedFrame: 0,
        frame: 0,
        lastSpawnedFrame: 0,
        stopped: !!_options.autoStart
    };
    const _snapshots = [];
    const callbacks = {
        onStop: [],
        onSpawn: []
    };
    const options = { spawnIntervalMs: 1000, ..._options };
    const { frameMethod, pixelsPerSecond, stopOnCollision } = options;
    const spawnedItems = [];
    const frameMs = 1000 / game.runtime.getFps();
    const isLocked = (spriteEntity) => {
        return spawnedItems.find(spawnedItem => spawnedItem.spriteEntity === spriteEntity)?.locked;
    };
    const isSpawned = (spriteEntity) => {
        return spawnedItems.find(spawnedItem => spawnedItem.spriteEntity === spriteEntity);
    };
    const spawn = ({ offsetPixelPosition = [0, 0], layer }) => {
        const { pixelPosition } = options;
        const position = [pixelPosition[0] + offsetPixelPosition[0], pixelPosition[1] + offsetPixelPosition[1]];
        const spriteEntity = spriteEntityFactory.create({
            pixelPosition: position,
            layer: layer || options.layer,
            network: true
        });
        state.stopped = false;
        if (options.spawnRandomFrame?.length) {
            const index = game.randomInt(0, options.spawnRandomFrame.length - 1);
            console.log("RANDOM_FRAME", index, options.spawnRandomFrame);
            spriteEntity.applyFrame(options.spawnRandomFrame[index]);
        }
        state.count++;
        const spawnedItem = {
            ID: spriteEntity.ID,
            klass: spriteEntity.klassParams.klass,
            locked: false,
            startFrame: state.frame,
            detectCollisions: spriteEntityFactory.collisionBox && !!stopOnCollision,
            spriteEntity: spriteEntity,
        };
        spawnedItem.toJSON = getSpriteSnapshotToJSONFn(spawnedItem);
        spawnedItems.push(spawnedItem);
        if (stopOnCollision) {
            spawnedItem.spriteEntity.onCollide(getCollisionListener({ spriteEntity, spawnedItem }));
        }
        callbacks.onSpawn.forEach(f => f(spriteEntity));
        state.lastSpawnedFrame = game.runtime.getCurrentFrameNumber();
        return spriteEntity;
    };
    function getCollisionListener({ spawnedItem, spriteEntity }) {
        return ({ otherSprite }) => {
            spawnedItem.locked = true;
            console.log("Collision calling onStop", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
            callbacks.onStop.forEach(f => f(spriteEntity));
        };
    }
    function getSpawnedSprites() {
        return game.getSpriteEntities().filter((e) => isSpawned(e));
    }
    return {
        spawn,
        setOptions: (_options) => {
            Object.assign(options, _options);
        },
        stop: () => {
            console.log("STOP!!", game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
            state.stopped = true;
            spawnedItems.forEach((_, index) => (_.locked = true));
        },
        start: () => {
            console.log("SPAWNER START", { ...state }, game.runtime.getPlayerIndex(), game.runtime.getState().lastReproducedFrame);
            state.count = 0;
            state.stopped = false;
            state.startedFrame = state.frame;
        },
        frame: (n) => {
            state.frame = n;
            if (state.stopped)
                return;
            if (state.startedFrame === undefined)
                return;
            const framesSinceStart = state.frame - state.startedFrame;
            const spawnIntervalFrames = Math.floor(options.spawnIntervalMs / frameMs);
            if (options.spawnIntervalMs && (((state.count + 1) * spawnIntervalFrames) < framesSinceStart)) {
                console.log("spawn", spawnIntervalFrames, state, state.count, state.frame);
                spawn({ layer: (options.layer || 1) + state.count });
            }
            spawnedItems.filter(i => !i.locked).forEach((spawnedItem, index) => {
                if (spawnedItem.locked)
                    return;
                const framesSinceStart = state.frame - spawnedItem.startFrame;
                const pixelsPerMs = options.pixelsPerSecond?.map(i => i / 1000);
                const newPixelPosition = [
                    spawnedItem.spriteEntity.createParams.pixelPosition[0] + Math.floor((framesSinceStart * frameMs) * pixelsPerMs[0]),
                    spawnedItem.spriteEntity.createParams.pixelPosition[1] + Math.floor((framesSinceStart * frameMs) * pixelsPerMs[1])
                ];
                spawnedItem.spriteEntity.setPixelPosition(...newPixelPosition);
                if ((newPixelPosition[0] > SCREEN_W) ||
                    (newPixelPosition[1] > SCREEN_H)) {
                    spawnedItem.locked = true;
                    spawnedItem.spriteEntity.destroy();
                    spawnedItems.splice(spawnedItems.indexOf(spawnedItem), 1);
                }
            });
            _snapshots.push({
                frameNumber: n,
                state: { ...state },
                spawnedItemsSnapshot: [...spawnedItems.map(s => s.toJSON())]
            });
        },
        isLocked,
        isSpawned,
        onCollide: () => { },
        onStop: (fn) => {
            callbacks.onStop.push(fn);
            return () => callbacks.onStop.splice(callbacks.onStop.indexOf(fn), 1);
        },
        onSpawn: (fn) => {
            callbacks.onSpawn.push(fn);
            return () => callbacks.onSpawn.splice(callbacks.onSpawn.indexOf(fn), 1);
        },
        cleanSprites: () => {
            spawnedItems.forEach(s => s.spriteEntity.destroy());
            spawnedItems.splice(0, spawnedItems.length);
        },
        rollbackToFrame: (frameNumber) => {
            console.log("spawner rollback from to", state.frame, frameNumber);
            const snapshot = _snapshots.find(snapshot => snapshot.frameNumber === frameNumber);
            console.log("spawner", state, JSON.stringify(snapshot, null, " "));
            Object.assign(state, snapshot.state);
            spawnedItems.splice(0, spawnedItems.length);
            const gameSpriteEntities = game.getSpriteEntities();
            console.log("gameSpriteEntities", gameSpriteEntities);
            snapshot.spawnedItemsSnapshot.forEach((spriteSnapshot) => {
                const spriteEntity = gameSpriteEntities.find((spriteEntity) => spriteEntity.ID === spriteSnapshot.ID);
                console.log("SPAWNER restoring snapshot sprite, to entity", spriteSnapshot.toJSON(), spriteEntity.toJSON());
                const spawnedItem = {
                    ...spriteSnapshot,
                    spriteEntity
                };
                spawnedItem.toJSON = getSpriteSnapshotToJSONFn(spawnedItem);
                spawnedItems.push(spawnedItem);
                if (stopOnCollision) {
                    spawnedItem.spriteEntity.onCollide(getCollisionListener({ spriteEntity, spawnedItem }));
                }
            });
            _snapshots.splice(frameNumber + 1, _snapshots.length - frameNumber - 1);
        },
        getSpawnedSprites,
        destroy: () => {
            spawnedItems.forEach(s => s.spriteEntity.destroy());
            spawnedItems.splice(0, spawnedItems.length);
            _snapshots.splice(0, _snapshots.length);
        }
    };
};
export function getPixelsPerSecond({ startPixelPosition, endPixelPosition, timeMs }) {
}
function getSpriteSnapshotToJSONFn(spawnedItem) {
    return () => {
        return { ...spawnedItem, spriteEntity: undefined };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3Bhd25lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NwYXduZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsTUFBTSxDQUFOLElBQVksdUJBSVg7QUFKRCxXQUFZLHVCQUF1QjtJQUMvQixxRUFBSSxDQUFBO0lBQ0oseUVBQU0sQ0FBQTtJQUNOLGlGQUFVLENBQUE7QUFDZCxDQUFDLEVBSlcsdUJBQXVCLEtBQXZCLHVCQUF1QixRQUlsQztBQWFELE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxDQUFDLG1CQUErQixFQUFFLFFBQXVCLEVBQUUsSUFBUSxFQUFFLEVBQUU7SUFDaEcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFFekcsTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hFLE1BQU0sS0FBSyxHQUFHO1FBQ1YsS0FBSyxFQUFDLENBQUM7UUFDUCxPQUFPLEVBQUMsQ0FBQztRQUNULEVBQUUsRUFBQyxDQUFDO1FBQ0osWUFBWSxFQUFDLENBQUM7UUFDZCxLQUFLLEVBQUMsQ0FBQztRQUNQLGdCQUFnQixFQUFDLENBQUM7UUFDbEIsT0FBTyxFQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUztLQUMvQixDQUFDO0lBQ0YsTUFBTSxVQUFVLEdBQVMsRUFBRSxDQUFDO0lBQzVCLE1BQU0sU0FBUyxHQUdYO1FBQ0EsTUFBTSxFQUFDLEVBQUU7UUFDVCxPQUFPLEVBQUMsRUFBRTtLQUNiLENBQUE7SUFHRCxNQUFNLE9BQU8sR0FBNkMsRUFBQyxlQUFlLEVBQUMsSUFBSSxFQUFFLEdBQUcsUUFBUSxFQUFDLENBQUM7SUFDOUYsTUFBTSxF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QUFFLFlBQVksRUFBQyxTQUFTLEVBQUMsQ0FBQTtJQUNuRCxDQUFDLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtTcHJpdGVFbnRpdHksIFNwcml0ZUtsYXNzLCBTcHJpdGVLbGFzc1BhcmFtc30gZnJvbSBcIi4vZ2FtZS1lbnRpdGllc1wiO1xuXG5leHBvcnQgZW51bSBTcGF3bmVyRnJhbWVTcGF3bk1ldGhvZCB7XG4gICAgU0FNRSxcbiAgICBSQU5ET00sXG4gICAgU0VRVUVOVElBTFxufVxuZXhwb3J0IHR5cGUgU3Bhd25lck9wdGlvbnMgPSB7XG4gICAgcGl4ZWxQb3NpdGlvbjpudW1iZXJbXSxcbiAgICBwaXhlbHNQZXJTZWNvbmQ6bnVtYmVyW10sLy9waXhlbHMgcGVyIHNlY29uZFxuICAgIGZyYW1lTWV0aG9kPzpTcGF3bmVyRnJhbWVTcGF3bk1ldGhvZCxcbiAgICBsYXllcj86bnVtYmVyLFxuICAgIHN0b3BPbkNvbGxpc2lvbj86Ym9vbGVhbixcbiAgICBkZXN0cm95T25TdG9wPzpib29sZWFuLFxuICAgIHNwYXduSW50ZXJ2YWxNcz86bnVtYmVyLFxuICAgIHNwYXduUmFuZG9tRnJhbWU/Om51bWJlcltdLFxuICAgIGF1dG9TdGFydD86Ym9vbGVhbixcbn1cblxuZXhwb3J0IGNvbnN0IGNyZWF0ZVNwYXduZXIgPSAoc3ByaXRlRW50aXR5RmFjdG9yeTpTcHJpdGVLbGFzcywgX29wdGlvbnM6U3Bhd25lck9wdGlvbnMsIGdhbWU6YW55KSA9PiB7XG4gICAgY29uc29sZS5sb2coXCJjcmVhdGVTcGF3bmVyXCIsIGdhbWUucnVudGltZS5nZXRQbGF5ZXJJbmRleCgpLCBnYW1lLnJ1bnRpbWUuZ2V0U3RhdGUoKS5sYXN0UmVwcm9kdWNlZEZyYW1lKTtcblxuICAgIGNvbnN0IFtTQ1JFRU5fVywgU0NSRUVOX0hdID0gZ2FtZS5ydW50aW1lLmdldFNjcmVlbigpLmdldFNpemUoKTsvL1RPRE8gcmV2aWV3IGxlYWsgYnkgcmVmZXJlbmNlXG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICAgIGNvdW50OjAsXG4gICAgICAgIHRvdGFsRHQ6MCxcbiAgICAgICAgZHQ6MCxcbiAgICAgICAgc3RhcnRlZEZyYW1lOjAsXG4gICAgICAgIGZyYW1lOjAsXG4gICAgICAgIGxhc3RTcGF3bmVkRnJhbWU6MCxcbiAgICAgICAgc3RvcHBlZDohIV9vcHRpb25zLmF1dG9TdGFydFxuICAgIH07XG4gICAgY29uc3QgX3NuYXBzaG90czphbnlbXSA9IFtdO1xuICAgIGNvbnN0IGNhbGxiYWNrczp7XG4gICAgICAgIG9uU3RvcDpGdW5jdGlvbltdLFxuICAgICAgICBvblNwYXduOkZ1bmN0aW9uW11cbiAgICB9ID0ge1xuICAgICAgICBvblN0b3A6W10sXG4gICAgICAgIG9uU3Bhd246W11cbiAgICB9XG5cblxuICAgIGNvbnN0IG9wdGlvbnM6U3Bhd25lck9wdGlvbnMgJiB7c3Bhd25JbnRlcnZhbE1zOm51bWJlcn0gPSB7c3Bhd25JbnRlcnZhbE1zOjEwMDAsIC4uLl9vcHRpb25zfTtcbiAgICBjb25zdCB7ZnJhbWVNZXRob2QsIHBpeGVsc1BlclNlY29uZCwgc3RvcE9uQ29sbGlzaW9ufSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgc3Bhd25lZEl0ZW1zOiB7XG4gICAgICAgIElEOiBudW1iZXI7XG4gICAgICAgIHNwcml0ZUVudGl0eTpTcHJpdGVFbnRpdHksIGxvY2tlZDpib29sZWFuLCBzdGFydEZyYW1lOm51bWJlcixkZXRlY3RDb2xsaXNpb25zOmJvb2xlYW4sIHRvSlNPTjpGdW5jdGlvbiB9W10gPSBbXTtcblxuICAgIGNvbnN0IGZyYW1lTXMgPSAxMDAwL2dhbWUucnVudGltZS5nZXRGcHMoKTsvL1RPRE9cblxuICAgIGNvbnN0IGlzTG9ja2VkID0gKHNwcml0ZUVudGl0eTpTcHJpdGVFbnRpdHkpPT57XG4gICAgICAgIHJldHVybiBzcGF3bmVkSXRlbXMuZmluZChzcGF3bmVkSXRlbSA9PiBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkgPT09IHNwcml0ZUVudGl0eSk/LmxvY2tlZDtcbiAgICB9O1xuICAgIGNvbnN0IGlzU3Bhd25lZCA9KHNwcml0ZUVudGl0eTpTcHJpdGVFbnRpdHkpPT57XG4gICAgICAgIHJldHVybiBzcGF3bmVkSXRlbXMuZmluZChzcGF3bmVkSXRlbSA9PiBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkgPT09IHNwcml0ZUVudGl0eSk7XG4gICAgfTtcbiAgICBjb25zdCBzcGF3biA9KHtvZmZzZXRQaXhlbFBvc2l0aW9uID0gWzAsMF0sIGxheWVyfTphbnkpID0+IHtcblxuICAgICAgICBjb25zdCB7cGl4ZWxQb3NpdGlvbn0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IFtwaXhlbFBvc2l0aW9uWzBdICsgb2Zmc2V0UGl4ZWxQb3NpdGlvblswXSwgcGl4ZWxQb3NpdGlvblsxXSArIG9mZnNldFBpeGVsUG9zaXRpb25bMV1dO1xuICAgICAgICBjb25zdCBzcHJpdGVFbnRpdHk6U3ByaXRlRW50aXR5ID0gc3ByaXRlRW50aXR5RmFjdG9yeS5jcmVhdGUoe1xuICAgICAgICAgICAgcGl4ZWxQb3NpdGlvbjpwb3NpdGlvbixcbiAgICAgICAgICAgIGxheWVyOmxheWVyIHx8IG9wdGlvbnMubGF5ZXIsXG4gICAgICAgICAgICBuZXR3b3JrOnRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHN0YXRlLnN0b3BwZWQgPSBmYWxzZVxuICAgICAgICBpZihvcHRpb25zLnNwYXduUmFuZG9tRnJhbWU/Lmxlbmd0aCl7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGdhbWUucmFuZG9tSW50KDAsb3B0aW9ucy5zcGF3blJhbmRvbUZyYW1lLmxlbmd0aC0xKSAgO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJSQU5ET01fRlJBTUVcIixpbmRleCxvcHRpb25zLnNwYXduUmFuZG9tRnJhbWUpXG4gICAgICAgICAgICBzcHJpdGVFbnRpdHkuYXBwbHlGcmFtZSggb3B0aW9ucy5zcGF3blJhbmRvbUZyYW1lW2luZGV4XSlcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5jb3VudCsrO1xuICAgICAgICBjb25zdCBzcGF3bmVkSXRlbTphbnkgPSB7XG4gICAgICAgICAgICBJRDpzcHJpdGVFbnRpdHkuSUQsXG4gICAgICAgICAgICBrbGFzczpzcHJpdGVFbnRpdHkua2xhc3NQYXJhbXMua2xhc3MsXG4gICAgICAgICAgICBsb2NrZWQ6ZmFsc2UsXG4gICAgICAgICAgICBzdGFydEZyYW1lOnN0YXRlLmZyYW1lLFxuICAgICAgICAgICAgZGV0ZWN0Q29sbGlzaW9uczpzcHJpdGVFbnRpdHlGYWN0b3J5LmNvbGxpc2lvbkJveCAmJiAhIXN0b3BPbkNvbGxpc2lvbixcbiAgICAgICAgICAgIHNwcml0ZUVudGl0eTpzcHJpdGVFbnRpdHksXG4gICAgICAgIH07XG5cbiAgICAgICAgc3Bhd25lZEl0ZW0udG9KU09OID0gZ2V0U3ByaXRlU25hcHNob3RUb0pTT05GbihzcGF3bmVkSXRlbSk7XG4gICAgICAgIHNwYXduZWRJdGVtcy5wdXNoKHNwYXduZWRJdGVtKTtcbiAgICAgICAgaWYoc3RvcE9uQ29sbGlzaW9uKXtcbiAgICAgICAgICAgIC8vVE9ETyBSRVZJRVcgd2UgbXVzdCBhZGQgdGhpcyBsaXN0ZW5lciBhbHNvIHdoZW4gcm9sbGJhY2sgYW5kIHRoZXJlIGlzIGFscmVhZHkgYSBzcGF3bmVkIGl0ZW0sIGJlY2F1c2UgbGlzdGVuZXIgd2FzIHJlbW92ZWQsLi4uIG9yIGRlY291cGxlIGNvbGxpc2lvbiBsaXN0ZW5lcnMgZnJvbSBlbnRpdGllc1xuICAgICAgICAgICAgc3Bhd25lZEl0ZW0uc3ByaXRlRW50aXR5Lm9uQ29sbGlkZShnZXRDb2xsaXNpb25MaXN0ZW5lcih7c3ByaXRlRW50aXR5LCBzcGF3bmVkSXRlbX0pKVxuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrcy5vblNwYXduLmZvckVhY2goZj0+ZihzcHJpdGVFbnRpdHkpKTtcbiAgICAgICAgc3RhdGUubGFzdFNwYXduZWRGcmFtZSA9IGdhbWUucnVudGltZS5nZXRDdXJyZW50RnJhbWVOdW1iZXIoKTtcbiAgICAgICAgcmV0dXJuIHNwcml0ZUVudGl0eTtcblxuXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldENvbGxpc2lvbkxpc3RlbmVyKHtzcGF3bmVkSXRlbSwgc3ByaXRlRW50aXR5fTphbnkpe1xuICAgICAgICByZXR1cm4gKHtvdGhlclNwcml0ZX06YW55KT0+e1xuXG4gICAgICAgICAgICBzcGF3bmVkSXRlbS5sb2NrZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkNvbGxpc2lvbiBjYWxsaW5nIG9uU3RvcFwiLCBnYW1lLnJ1bnRpbWUuZ2V0UGxheWVySW5kZXgoKSwgZ2FtZS5ydW50aW1lLmdldFN0YXRlKCkubGFzdFJlcHJvZHVjZWRGcmFtZSk7XG4gICAgICAgICAgICAvLyBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkuZGV0ZWN0Q29sbGlzaW9ucyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3RvcC5mb3JFYWNoKGY9PmYoc3ByaXRlRW50aXR5KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTcGF3bmVkU3ByaXRlcygpe1xuICAgICAgICByZXR1cm4gZ2FtZS5nZXRTcHJpdGVFbnRpdGllcygpLmZpbHRlcigoZTpTcHJpdGVFbnRpdHkpPT5pc1NwYXduZWQoZSkpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBzcGF3bixcbiAgICAgICAgc2V0T3B0aW9uczogKF9vcHRpb25zOmFueSkgPT4ge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihvcHRpb25zLCBfb3B0aW9ucyk7XG4gICAgICAgIH0sXG4gICAgICAgIHN0b3A6ICgpID0+e1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJTVE9QISFcIiwgZ2FtZS5ydW50aW1lLmdldFBsYXllckluZGV4KCksIGdhbWUucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWUpO1xuXG4gICAgICAgICAgICBzdGF0ZS5zdG9wcGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHNwYXduZWRJdGVtcy5mb3JFYWNoKChfLGluZGV4KT0+KF8ubG9ja2VkID0gdHJ1ZSkpXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXJ0OiAoKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNQQVdORVIgU1RBUlRcIiwgey4uLnN0YXRlfSwgZ2FtZS5ydW50aW1lLmdldFBsYXllckluZGV4KCksIGdhbWUucnVudGltZS5nZXRTdGF0ZSgpLmxhc3RSZXByb2R1Y2VkRnJhbWUpO1xuICAgICAgICAgICAgc3RhdGUuY291bnQgPSAwO1xuICAgICAgICAgICAgc3RhdGUuc3RvcHBlZCA9IGZhbHNlO1xuICAgICAgICAgICAgc3RhdGUuc3RhcnRlZEZyYW1lID0gc3RhdGUuZnJhbWU7XG4gICAgICAgIH0sXG4gICAgICAgIGZyYW1lOiAobjpudW1iZXIpID0+IHtcbiAgICAgICAgICAgIHN0YXRlLmZyYW1lID0gbjtcblxuICAgICAgICAgICAgaWYoc3RhdGUuc3RvcHBlZCkgcmV0dXJuO1xuICAgICAgICAgICAgaWYoc3RhdGUuc3RhcnRlZEZyYW1lID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lc1NpbmNlU3RhcnQgPSBzdGF0ZS5mcmFtZSAtIHN0YXRlLnN0YXJ0ZWRGcmFtZTtcbiAgICAgICAgICAgIGNvbnN0IHNwYXduSW50ZXJ2YWxGcmFtZXMgPSBNYXRoLmZsb29yKG9wdGlvbnMuc3Bhd25JbnRlcnZhbE1zIC8gZnJhbWVNcyk7XG5cbiAgICAgICAgICAgIGlmKG9wdGlvbnMuc3Bhd25JbnRlcnZhbE1zICYmICgoKHN0YXRlLmNvdW50KzEpICogc3Bhd25JbnRlcnZhbEZyYW1lcykgPCBmcmFtZXNTaW5jZVN0YXJ0KSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzcGF3blwiLCBzcGF3bkludGVydmFsRnJhbWVzLHN0YXRlLHN0YXRlLmNvdW50LCBzdGF0ZS5mcmFtZSk7XG4gICAgICAgICAgICAgICAgc3Bhd24oe2xheWVyOihvcHRpb25zLmxheWVyfHwxKStzdGF0ZS5jb3VudH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzcGF3bmVkSXRlbXMuZmlsdGVyKGk9PiFpLmxvY2tlZCkuZm9yRWFjaCgoc3Bhd25lZEl0ZW0sIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYoc3Bhd25lZEl0ZW0ubG9ja2VkKSByZXR1cm47XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVzU2luY2VTdGFydCA9IHN0YXRlLmZyYW1lIC0gc3Bhd25lZEl0ZW0uc3RhcnRGcmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwaXhlbHNQZXJNczpudW1iZXJbXSA9IG9wdGlvbnMucGl4ZWxzUGVyU2Vjb25kPy5tYXAoaT0+aS8xMDAwKTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdQaXhlbFBvc2l0aW9uID0gW1xuICAgICAgICAgICAgICAgICAgICBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkuY3JlYXRlUGFyYW1zLnBpeGVsUG9zaXRpb25bMF0gKyBNYXRoLmZsb29yKChmcmFtZXNTaW5jZVN0YXJ0ICogZnJhbWVNcykgKiBwaXhlbHNQZXJNc1swXSksXG4gICAgICAgICAgICAgICAgICAgIHNwYXduZWRJdGVtLnNwcml0ZUVudGl0eS5jcmVhdGVQYXJhbXMucGl4ZWxQb3NpdGlvblsxXSArIE1hdGguZmxvb3IoKGZyYW1lc1NpbmNlU3RhcnQgKiBmcmFtZU1zKSAqIHBpeGVsc1Blck1zWzFdKVxuICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkuc2V0UGl4ZWxQb3NpdGlvbiguLi5uZXdQaXhlbFBvc2l0aW9uKTtcblxuICAgICAgICAgICAgICAgIGlmKFxuICAgICAgICAgICAgICAgICAgICAobmV3UGl4ZWxQb3NpdGlvblswXSA+IFNDUkVFTl9XKSB8fFxuICAgICAgICAgICAgICAgICAgICAobmV3UGl4ZWxQb3NpdGlvblsxXSA+IFNDUkVFTl9IIClcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW0ubG9ja2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW0uc3ByaXRlRW50aXR5LmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW1zLnNwbGljZShzcGF3bmVkSXRlbXMuaW5kZXhPZihzcGF3bmVkSXRlbSksIDEpO1xuICAgICAgICAgICAgICAgICAgICAvL1RPRE8gd2Ugc2hvdWxkIHJlbW92ZVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgX3NuYXBzaG90cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBmcmFtZU51bWJlcjpuLFxuICAgICAgICAgICAgICAgIHN0YXRlOiB7IC4uLnN0YXRlIH0sXG4gICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW1zU25hcHNob3Q6Wy4uLnNwYXduZWRJdGVtcy5tYXAocz0+cy50b0pTT04oKSldXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgaXNMb2NrZWQsXG4gICAgICAgIGlzU3Bhd25lZCxcbiAgICAgICAgb25Db2xsaWRlOigpPT57fSxcbiAgICAgICAgb25TdG9wOihmbjpGdW5jdGlvbik9PntcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0b3AucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCk9PiBjYWxsYmFja3Mub25TdG9wLnNwbGljZShjYWxsYmFja3Mub25TdG9wLmluZGV4T2YoZm4pLDEpXG4gICAgICAgIH0sXG4gICAgICAgIG9uU3Bhd246KGZuOkZ1bmN0aW9uKT0+e1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3Bhd24ucHVzaChmbik7XG4gICAgICAgICAgICByZXR1cm4gKCk9PiBjYWxsYmFja3Mub25TcGF3bi5zcGxpY2UoY2FsbGJhY2tzLm9uU3Bhd24uaW5kZXhPZihmbiksMSlcbiAgICAgICAgfSxcbiAgICAgICAgY2xlYW5TcHJpdGVzOiAoKSA9PiB7XG4gICAgICAgICAgICBzcGF3bmVkSXRlbXMuZm9yRWFjaChzID0+IHMuc3ByaXRlRW50aXR5LmRlc3Ryb3koKSk7XG4gICAgICAgICAgICBzcGF3bmVkSXRlbXMuc3BsaWNlKDAsIHNwYXduZWRJdGVtcy5sZW5ndGgpO1xuICAgICAgICB9LFxuICAgICAgICByb2xsYmFja1RvRnJhbWU6IChmcmFtZU51bWJlcjpudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic3Bhd25lciByb2xsYmFjayBmcm9tIHRvXCIsIHN0YXRlLmZyYW1lLCBmcmFtZU51bWJlcik7XG4gICAgICAgICAgICBjb25zdCBzbmFwc2hvdCA9IF9zbmFwc2hvdHMuZmluZChzbmFwc2hvdD0+c25hcHNob3QuZnJhbWVOdW1iZXIgPT09IGZyYW1lTnVtYmVyKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic3Bhd25lclwiLCBzdGF0ZSwgSlNPTi5zdHJpbmdpZnkoc25hcHNob3QsbnVsbCwgXCIgXCIpKTtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oc3RhdGUsIHNuYXBzaG90LnN0YXRlKTtcblxuICAgICAgICAgICAgc3Bhd25lZEl0ZW1zLnNwbGljZSgwLCBzcGF3bmVkSXRlbXMubGVuZ3RoKTtcblxuICAgICAgICAgICAgY29uc3QgZ2FtZVNwcml0ZUVudGl0aWVzID0gZ2FtZS5nZXRTcHJpdGVFbnRpdGllcygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJnYW1lU3ByaXRlRW50aXRpZXNcIixnYW1lU3ByaXRlRW50aXRpZXMpO1xuICAgICAgICAgICAgc25hcHNob3Quc3Bhd25lZEl0ZW1zU25hcHNob3QuZm9yRWFjaCgoc3ByaXRlU25hcHNob3Q6YW55KT0+e1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwcml0ZUVudGl0eSA9IGdhbWVTcHJpdGVFbnRpdGllcy5maW5kKChzcHJpdGVFbnRpdHk6U3ByaXRlRW50aXR5KSA9PiBzcHJpdGVFbnRpdHkuSUQgPT09IHNwcml0ZVNuYXBzaG90LklEKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlNQQVdORVIgcmVzdG9yaW5nIHNuYXBzaG90IHNwcml0ZSwgdG8gZW50aXR5XCIsIHNwcml0ZVNuYXBzaG90LnRvSlNPTigpLCBzcHJpdGVFbnRpdHkudG9KU09OKCkpXG4gICAgICAgICAgICAgICAgY29uc3Qgc3Bhd25lZEl0ZW0gPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnNwcml0ZVNuYXBzaG90LFxuICAgICAgICAgICAgICAgICAgICBzcHJpdGVFbnRpdHlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW0udG9KU09OID0gZ2V0U3ByaXRlU25hcHNob3RUb0pTT05GbihzcGF3bmVkSXRlbSk7XG4gICAgICAgICAgICAgICAgc3Bhd25lZEl0ZW1zLnB1c2goc3Bhd25lZEl0ZW0pO1xuICAgICAgICAgICAgICAgIGlmKHN0b3BPbkNvbGxpc2lvbil7XG4gICAgICAgICAgICAgICAgICAgIC8vVE9ETyBSRVZJRVcgd2UgbXVzdCBhZGQgdGhpcyBsaXN0ZW5lciBhbHNvIHdoZW4gcm9sbGJhY2sgYW5kIHRoZXJlIGlzIGFscmVhZHkgYSBzcGF3bmVkIGl0ZW0sIGJlY2F1c2UgbGlzdGVuZXIgd2FzIHJlbW92ZWQsLi4uIG9yIGRlY291cGxlIGNvbGxpc2lvbiBsaXN0ZW5lcnMgZnJvbSBlbnRpdGllc1xuICAgICAgICAgICAgICAgICAgICBzcGF3bmVkSXRlbS5zcHJpdGVFbnRpdHkub25Db2xsaWRlKGdldENvbGxpc2lvbkxpc3RlbmVyKHtzcHJpdGVFbnRpdHksIHNwYXduZWRJdGVtfSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF9zbmFwc2hvdHMuc3BsaWNlKGZyYW1lTnVtYmVyICsgMSwgX3NuYXBzaG90cy5sZW5ndGggLSBmcmFtZU51bWJlciAtIDEpO1xuICAgICAgICB9LFxuICAgICAgICBnZXRTcGF3bmVkU3ByaXRlcyxcbiAgICAgICAgZGVzdHJveTooKT0+e1xuICAgICAgICAgICAgc3Bhd25lZEl0ZW1zLmZvckVhY2gocyA9PiBzLnNwcml0ZUVudGl0eS5kZXN0cm95KCkpO1xuICAgICAgICAgICAgc3Bhd25lZEl0ZW1zLnNwbGljZSgwLCBzcGF3bmVkSXRlbXMubGVuZ3RoKTtcbiAgICAgICAgICAgIF9zbmFwc2hvdHMuc3BsaWNlKDAsIF9zbmFwc2hvdHMubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFBpeGVsc1BlclNlY29uZCh7c3RhcnRQaXhlbFBvc2l0aW9uLCBlbmRQaXhlbFBvc2l0aW9uLCB0aW1lTXN9OntzdGFydFBpeGVsUG9zaXRpb246bnVtYmVyW10sZW5kUGl4ZWxQb3NpdGlvbjpudW1iZXJbXSwgdGltZU1zOm51bWJlcn0pe1xuXG59XG5cbmZ1bmN0aW9uIGdldFNwcml0ZVNuYXBzaG90VG9KU09ORm4oc3Bhd25lZEl0ZW06YW55KXtcbiAgICByZXR1cm4gKCkgPT4ge1xuXG4gICAgICAgIHJldHVybiB7Li4uc3Bhd25lZEl0ZW0sIHNwcml0ZUVudGl0eTp1bmRlZmluZWR9XG4gICAgfTtcbn0iXX0=