async function getData(){
    const url = 'https://kiet.cybervidya.net/api/auth/login';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
              },
            body: JSON.stringify({
              'userName': document.getElementById("username").value,
              'password': document.getElementById("password").value,
            })});
        if (!response.ok) {
          throw new Error(`Response status: ${response.status}`);
        }
    
        const json = await response.json();
        // console.log(json.data.token);
        document.cookie =`token=${json.data.token}`;
        location.replace("/")

    } catch (error) {
        console.error(error.message);
      }
}
