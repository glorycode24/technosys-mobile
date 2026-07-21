from PIL import Image

def pad_icon():
    try:
        # Open the original square icon (e.g., 1024x1024)
        img = Image.open('assets/images/icon.png').convert("RGBA")
        
        # Adaptive icons need the main content in the inner 66%. 
        # For a 1024x1024 canvas, the safe zone is ~675x675.
        target_size = int(1024 * 0.60) # use 60% to be safe and avoid tight borders
        
        # Resize the original icon
        img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
        
        # Create a new transparent 1024x1024 canvas
        canvas = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
        
        # Paste the resized icon into the center
        offset = ((1024 - img.width) // 2, (1024 - img.height) // 2)
        canvas.paste(img, offset, img)
        
        # Save as the android-icon-foreground.png
        canvas.save('assets/images/android-icon-foreground.png')
        print("Successfully created padded android-icon-foreground.png!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    pad_icon()
