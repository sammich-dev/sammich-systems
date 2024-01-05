import { dclSleep } from "./dcl-sleep";
import { DEFAULT_SPRITE_DEF } from "../../../sprite-constants";
const SUM_SCORE_TEXT_POSITIONS = [
    [(192 / 4), 128 / 4 - 16],
    [(192 / 4) * 3, 128 / 4 - 16]
];
const textColor = [1, 1, 1, 1];
export function createGlobalScoreTransition(screen) {
    const winnerSprite = screen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 388, y: 473,
            w: 128, h: 28
        },
        pixelPosition: [100, 10],
        layer: 3
    });
    const loserSprite = screen.addSprite({
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 433, y: 397,
            w: 62, h: 21
        },
        pixelPosition: [4, 10],
        layer: 3
    });
    const player1GlobalScoreBig = screen.addText({
        pixelPosition: [192 / 4, 128 / 4],
        textAlign: 4,
        text: "0",
        fontSize: 2,
        textColor,
        layer: 3
    });
    const winnerSumPointsText = screen.addText({
        pixelPosition: SUM_SCORE_TEXT_POSITIONS[0],
        textAlign: 4,
        text: "+1",
        fontSize: 1,
        textColor,
        layer: 3
    });
    const player2GlobalScoreBig = screen.addText({
        pixelPosition: [(192 / 4) * 3, 128 / 4],
        textAlign: 4,
        text: "0",
        fontSize: 2,
        textColor,
        layer: 3
    });
    const finalSprite = screen.addSprite({
        pixelPosition: [0, 0],
        spriteDefinition: {
            ...DEFAULT_SPRITE_DEF,
            x: 192, y: 128,
            w: 192, h: 128
        },
        layer: 2,
        zoom: [1, 1]
    });
    const hide = () => {
        winnerSprite.hide();
        loserSprite.hide();
        player1GlobalScoreBig.hide();
        winnerSumPointsText.hide();
        player2GlobalScoreBig.hide();
    };
    finalSprite.hide();
    hide();
    return {
        destroy: () => {
        },
        hide,
        showTransition: async ({ winnerIndex, previousScores }) => {
            winnerSprite.show();
            loserSprite.show();
            player1GlobalScoreBig.show();
            player2GlobalScoreBig.show();
            await dclSleep(1000);
            player1GlobalScoreBig.setText(previousScores[0]);
            player2GlobalScoreBig.setText(previousScores[1]);
            if (winnerIndex === 0) {
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[0]);
                winnerSumPointsText.show();
                await dclSleep(1000);
                winnerSumPointsText.hide();
                player1GlobalScoreBig.setText((previousScores[winnerIndex] + 1).toString());
            }
            else if (winnerIndex === 1) {
                winnerSumPointsText.setPixelPosition(...SUM_SCORE_TEXT_POSITIONS[1]);
                winnerSumPointsText.show();
                await dclSleep(1000);
                winnerSumPointsText.hide();
                player2GlobalScoreBig.setText((previousScores[winnerIndex] + 1).toString());
            }
            await dclSleep(2000);
        },
        showFinalSprite: async (trackWinnerIndex) => {
            finalSprite.show();
            finalSprite.setZoom([trackWinnerIndex ? -1 : 1, 1]);
            await dclSleep(5000);
            finalSprite.hide();
        },
        reset: () => {
            player1GlobalScoreBig.setText("0");
            player2GlobalScoreBig.setText("0");
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcmUtdHJhbnNpdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9kY2wtc3ByaXRlLXNjcmVlbi9zY29yZS10cmFuc2l0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFFN0QsTUFBTSx3QkFBd0IsR0FBRTtJQUM1QixDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQ2pDLENBQUM7QUFDRixNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxNQUFVO0lBRWxELE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDbEMsZ0JBQWdCLEVBQUM7WUFDYixHQUFHLGtCQUFrQjtZQUNyQixDQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsRUFBQyxHQUFHO1lBQ1osQ0FBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUMsRUFBRTtTQUNkO1FBQ0QsYUFBYSxFQUFDLENBQUMsR0FBRyxFQUFDLEVBQUUsQ0FBQztRQUN0QixLQUFLLEVBQUMsQ0FBQztLQUNWLENBQUMsQ0FBQztJQUVILE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDakMsZ0JBQWdCLEVBQUM7WUFDYixHQUFHLGtCQUFrQjtZQUNyQixDQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsRUFBQyxHQUFHO1lBQ1osQ0FBQyxFQUFDLEVBQUUs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QUNKLENBQUE7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtUZXh0QWxpZ25Nb2RlfSBmcm9tIFwiQGRjbC9zZGsvZWNzXCI7XG5pbXBvcnQge2RjbFNsZWVwfSBmcm9tIFwiLi9kY2wtc2xlZXBcIjtcbmltcG9ydCB7REVGQVVMVF9TUFJJVEVfREVGfSBmcm9tIFwiLi4vLi4vLi4vc3ByaXRlLWNvbnN0YW50c1wiO1xuXG5jb25zdCBTVU1fU0NPUkVfVEVYVF9QT1NJVElPTlMgPVtcbiAgICBbKDE5MiAvIDQpICwgMTI4IC8gNCAtIDE2XSwvL3BsYXllcjFcbiAgICBbKDE5MiAvIDQpICogMyAsIDEyOCAvIDQgLSAxNl0vL3BsYXllcjJcbl07XG5jb25zdCB0ZXh0Q29sb3IgPSBbMSwxLDEsMV07XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlR2xvYmFsU2NvcmVUcmFuc2l0aW9uKHNjcmVlbjphbnkpe1xuXG4gICAgY29uc3Qgd2lubmVyU3ByaXRlID0gc2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246e1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDozODgsIHk6NDczLFxuICAgICAgICAgICAgdzoxMjgsIGg6MjhcbiAgICAgICAgfSxcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjpbMTAwLDEwXSxcbiAgICAgICAgbGF5ZXI6M1xuICAgIH0pO1xuICAgIC8vd2lubmVyU3ByaXRlLmhpZGUoKVxuICAgIGNvbnN0IGxvc2VyU3ByaXRlID0gc2NyZWVuLmFkZFNwcml0ZSh7XG4gICAgICAgIHNwcml0ZURlZmluaXRpb246e1xuICAgICAgICAgICAgLi4uREVGQVVMVF9TUFJJVEVfREVGLFxuICAgICAgICAgICAgeDo0MzMsIHk6Mzk3LFxuICAgICAgICAgICAgdzo2MiwgaDoyMVxuICAgICAgICB9LFxuICAgICAgICBwaXhlbFBvc2l0aW9uOls0LDEwXSxcbiAgICAgICAgbGF5ZXI6M1xuICAgIH0pO1xuICAgIC8vbG9zZXJTcHJpdGUuaGlkZSgpO1xuXG4gICAgY29uc3QgcGxheWVyMUdsb2JhbFNjb3JlQmlnID0gc2NyZWVuLmFkZFRleHQoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOlsxOTIvNCwxMjgvNF0sXG4gICAgICAgIHRleHRBbGlnbjpUZXh0QWxpZ25Nb2RlLlRBTV9NSURETEVfQ0VOVEVSLFxuICAgICAgICB0ZXh0OlwiMFwiLFxuICAgICAgICBmb250U2l6ZToyLFxuICAgICAgICB0ZXh0Q29sb3IsXG4gICAgICAgIGxheWVyOjNcbiAgICB9KTtcbiAgICBjb25zdCB3aW5uZXJTdW1Qb2ludHNUZXh0ID0gc2NyZWVuLmFkZFRleHQoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOlNVTV9TQ09SRV9URVhUX1BPU0lUSU9OU1swXSxcbiAgICAgICAgdGV4dEFsaWduOlRleHRBbGlnbk1vZGUuVEFNX01JRERMRV9DRU5URVIsXG4gICAgICAgIHRleHQ6XCIrMVwiLFxuICAgICAgICBmb250U2l6ZToxLFxuICAgICAgICB0ZXh0Q29sb3IsXG4gICAgICAgIGxheWVyOjNcbiAgICB9KVxuICAgIGNvbnN0IHBsYXllcjJHbG9iYWxTY29yZUJpZyA9IHNjcmVlbi5hZGRUZXh0KHtcbiAgICAgICAgcGl4ZWxQb3NpdGlvbjogWygxOTIgLyA0KSAqIDMsIDEyOCAvIDRdLFxuICAgICAgICB0ZXh0QWxpZ246VGV4dEFsaWduTW9kZS5UQU1fTUlERExFX0NFTlRFUixcbiAgICAgICAgdGV4dDpcIjBcIixcbiAgICAgICAgZm9udFNpemU6MixcbiAgICAgICAgdGV4dENvbG9yLFxuICAgICAgICBsYXllcjozXG4gICAgfSk7XG5cbiAgICBjb25zdCBmaW5hbFNwcml0ZSA9IHNjcmVlbi5hZGRTcHJpdGUoe1xuICAgICAgICBwaXhlbFBvc2l0aW9uOlswLDBdLFxuICAgICAgICBzcHJpdGVEZWZpbml0aW9uOntcbiAgICAgICAgICAgIC4uLkRFRkFVTFRfU1BSSVRFX0RFRixcbiAgICAgICAgICAgIHg6MTkyLCB5OjEyOCxcbiAgICAgICAgICAgIHc6MTkyLCBoOjEyOFxuICAgICAgICB9LFxuICAgICAgICBsYXllcjoyLFxuICAgICAgICB6b29tOlsxLDFdXG4gICAgfSk7XG4gICAgY29uc3QgaGlkZSA9ICgpPT57XG4gICAgICAgIHdpbm5lclNwcml0ZS5oaWRlKCk7XG4gICAgICAgIGxvc2VyU3ByaXRlLmhpZGUoKTtcbiAgICAgICAgcGxheWVyMUdsb2JhbFNjb3JlQmlnLmhpZGUoKTtcbiAgICAgICAgd2lubmVyU3VtUG9pbnRzVGV4dC5oaWRlKCk7XG4gICAgICAgIHBsYXllcjJHbG9iYWxTY29yZUJpZy5oaWRlKCk7XG4gICAgfTtcblxuICAgIGZpbmFsU3ByaXRlLmhpZGUoKTtcbiAgICBoaWRlKCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBkZXN0cm95OigpPT57XG5cbiAgICAgICAgfSxcbiAgICAgICAgaGlkZSxcbiAgICAgICAgc2hvd1RyYW5zaXRpb246YXN5bmMgKHt3aW5uZXJJbmRleCwgcHJldmlvdXNTY29yZXN9OmFueSk9PntcbiAgICAgICAgICAgIHdpbm5lclNwcml0ZS5zaG93KCk7XG4gICAgICAgICAgICBsb3NlclNwcml0ZS5zaG93KCk7XG4gICAgICAgICAgICBwbGF5ZXIxR2xvYmFsU2NvcmVCaWcuc2hvdygpO1xuICAgICAgICAgICAgcGxheWVyMkdsb2JhbFNjb3JlQmlnLnNob3coKTtcblxuICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMTAwMCk7XG4gICAgICAgICAgICBwbGF5ZXIxR2xvYmFsU2NvcmVCaWcuc2V0VGV4dChwcmV2aW91c1Njb3Jlc1swXSlcbiAgICAgICAgICAgIHBsYXllcjJHbG9iYWxTY29yZUJpZy5zZXRUZXh0KHByZXZpb3VzU2NvcmVzWzFdKVxuICAgICAgICAgICAgaWYod2lubmVySW5kZXggPT09IDApe1xuICAgICAgICAgICAgICAgIHdpbm5lclN1bVBvaW50c1RleHQuc2V0UGl4ZWxQb3NpdGlvbiguLi5TVU1fU0NPUkVfVEVYVF9QT1NJVElPTlNbMF0pO1xuICAgICAgICAgICAgICAgIHdpbm5lclN1bVBvaW50c1RleHQuc2hvdygpO1xuICAgICAgICAgICAgICAgIGF3YWl0IGRjbFNsZWVwKDEwMDApO1xuICAgICAgICAgICAgICAgIHdpbm5lclN1bVBvaW50c1RleHQuaGlkZSgpO1xuICAgICAgICAgICAgICAgIHBsYXllcjFHbG9iYWxTY29yZUJpZy5zZXRUZXh0KChwcmV2aW91c1Njb3Jlc1t3aW5uZXJJbmRleF0rMSkudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB9ZWxzZSBpZih3aW5uZXJJbmRleCA9PT0gMSl7XG4gICAgICAgICAgICAgICAgd2lubmVyU3VtUG9pbnRzVGV4dC5zZXRQaXhlbFBvc2l0aW9uKC4uLlNVTV9TQ09SRV9URVhUX1BPU0lUSU9OU1sxXSk7XG4gICAgICAgICAgICAgICAgd2lubmVyU3VtUG9pbnRzVGV4dC5zaG93KCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZGNsU2xlZXAoMTAwMCk7XG4gICAgICAgICAgICAgICAgd2lubmVyU3VtUG9pbnRzVGV4dC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgcGxheWVyMkdsb2JhbFNjb3JlQmlnLnNldFRleHQoKHByZXZpb3VzU2NvcmVzW3dpbm5lckluZGV4XSsxKS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IGRjbFNsZWVwKDIwMDApO1xuICAgICAgICB9LFxuICAgICAgICBzaG93RmluYWxTcHJpdGU6YXN5bmMgKHRyYWNrV2lubmVySW5kZXg6bnVtYmVyKT0+e1xuICAgICAgICAgICAgZmluYWxTcHJpdGUuc2hvdygpO1xuICAgICAgICAgICAgZmluYWxTcHJpdGUuc2V0Wm9vbShbdHJhY2tXaW5uZXJJbmRleD8tMToxLDFdKTtcbiAgICAgICAgICAgIGF3YWl0IGRjbFNsZWVwKDUwMDApO1xuICAgICAgICAgICAgZmluYWxTcHJpdGUuaGlkZSgpO1xuICAgICAgICB9LFxuICAgICAgICByZXNldDooKT0+e1xuICAgICAgICAgICAgcGxheWVyMUdsb2JhbFNjb3JlQmlnLnNldFRleHQoXCIwXCIpO1xuICAgICAgICAgICAgcGxheWVyMkdsb2JhbFNjb3JlQmlnLnNldFRleHQoXCIwXCIpO1xuICAgICAgICB9XG4gICAgfVxufSJdfQ==