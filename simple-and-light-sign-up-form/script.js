const docs = document.querySelector('.btn.docs')
const openapi = document.querySelector('.btn.openapi')
const button = document.querySelector('.btn.signup')
const form = document.querySelector('.form')

docs.addEventListener('click', function () {
   window.location = "https://docs.ns-api.com";
});

openapi.addEventListener('click', function () {
   var file_path = 'https://docs.ns-api.com/openapi/64d6a0b0af8ec900125a1450';
   var a = document.createElement('A');
   a.href = file_path;
   a.download = "ns-api.openapi3_1.json";
   a.target = "_blank";
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
});

button.addEventListener('click', function () {
   let name = document.getElementById("name");
   let email = document.getElementById("email");
   if (name.value == "" || email.value == "" ) {
      document.querySelector('.status').innerHTML = "Please complete form...";
      return;
   }
   let signupUrl = "https://ns-api-signup.netsapiens.com/signup";
   //signupUrl = "http://localhost:3295/signup"; Non proxied local testing

   document.querySelector('.status').innerHTML = "Running...";
   fetch(signupUrl, {
      method: 'POST',
      headers: {
         'Accept': 'application/json',
         'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: name.value, email: email.value })
   })
      .then(response => {
         if (response.status === 200) {
            return response.json();
         } else {
            document.querySelector('.status').innerHTML = "Error: " + 'Something went wrong on api server!';
            throw new Error('Something went wrong on api server!');
         }
      })
      .then(response => {
         if (response.status === "ok") {
            document.querySelector('.status').innerHTML = "Success!";
         } else {
            if (response.message) document.querySelector('.status').innerHTML = "Error: " + response.message;
            else if (response.code) document.querySelector('.status').innerHTML = "Error: " + response.code;
            else document.querySelector('.status').innerHTML = "Error ";
         }

         var steps = document.querySelector('.steps');
         let i = 0;

         while (i < response.steps.length) {
            console.log(response.steps[i]);
            var newLI = document.createElement('li');
            newLI.appendChild(document.createTextNode(response.steps[i]));
            steps.appendChild(newLI);
            i++;
         }


      })

});

