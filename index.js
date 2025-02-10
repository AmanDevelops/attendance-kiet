function getAllCookies() {
    const cookies = document.cookie.split('; ');
    const cookieMap = {};
    cookies.forEach(cookie => {
        const [name, value] = cookie.split('=');
        cookieMap[name] = value;
    });
    return cookieMap.token;
}


async function getData(){
    const url = 'https://kiet.cybervidya.net/api/attendance/course/component/student';
    const token = getAllCookies();
    try {
        fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Authorization': `GlobalEducation ${token}`,
              },
            })
        .then(response => response.json())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });

    } catch (error) {
        console.error(error.message);
      }
}

getData();