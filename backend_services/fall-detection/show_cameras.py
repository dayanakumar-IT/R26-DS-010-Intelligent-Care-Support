import cv2

for i in range(5):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret and frame is not None:
            cv2.imshow(f"Camera {i} - press any key", frame)
            print(f"Camera index {i} works - showing preview")
            cv2.waitKey(2000)  # show for 2 seconds
        else:
            print(f"Camera index {i} opens but no frame")
        cap.release()
        cv2.destroyAllWindows()
    else:
        print(f"Camera index {i} not found")

print("Done - use the index that showed your USB camera feed")
