export default {
    isPointIn(pointX, pointY, targetX, targetY, targetWidth, targetHeight) {
        return pointX >= targetX && pointX < targetX + targetWidth
            && pointY >= targetY && pointY < targetY + targetHeight
    },
    getDistance(sourcePosX, sourcePosY, targetPosX, targetPosY) {
        return Math.hypot(targetPosX-sourcePosX, targetPosY-sourcePosY)
    }
}